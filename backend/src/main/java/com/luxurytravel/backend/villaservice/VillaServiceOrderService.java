package com.luxurytravel.backend.villaservice;

import com.luxurytravel.backend.roombooking.RoomBooking;
import com.luxurytravel.backend.roombooking.RoomBookingRepository;
import com.luxurytravel.backend.roombooking.RoomBookingResponse;
import com.luxurytravel.backend.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class VillaServiceOrderService {
    private static final String ORDER_TYPE_BOOKING = "BOOKING";
    private static final String ORDER_TYPE_STANDALONE = "STANDALONE";
    private static final String STATUS_OPEN = "OPEN";
    private static final String STATUS_COMPLETED = "COMPLETED";
    private static final String STATUS_CANCELLED = "CANCELLED";
    private static final String TARGET_TYPE_ORDER = "ORDER";

    private final VillaServiceOrderRepository villaServiceOrderRepository;
    private final VillaServiceOrderItemRepository villaServiceOrderItemRepository;
    private final VillaServiceCatalogRepository villaServiceCatalogRepository;
    private final VillaServiceCatalogService villaServiceCatalogService;
    private final VillaServiceLogRepository villaServiceLogRepository;
    private final RoomBookingRepository roomBookingRepository;

    public VillaServiceOrderService(
            VillaServiceOrderRepository villaServiceOrderRepository,
            VillaServiceOrderItemRepository villaServiceOrderItemRepository,
            VillaServiceCatalogRepository villaServiceCatalogRepository,
            VillaServiceCatalogService villaServiceCatalogService,
            VillaServiceLogRepository villaServiceLogRepository,
            RoomBookingRepository roomBookingRepository
    ) {
        this.villaServiceOrderRepository = villaServiceOrderRepository;
        this.villaServiceOrderItemRepository = villaServiceOrderItemRepository;
        this.villaServiceCatalogRepository = villaServiceCatalogRepository;
        this.villaServiceCatalogService = villaServiceCatalogService;
        this.villaServiceLogRepository = villaServiceLogRepository;
        this.roomBookingRepository = roomBookingRepository;
    }

    @Transactional(readOnly = true)
    public List<VillaServiceOrderResponse> list(String orderType, String status, String query) {
        String normalizedOrderType = normalizeFilter(orderType);
        String normalizedStatus = normalizeFilter(status);
        String normalizedQuery = normalizeFilter(query);

        return villaServiceOrderRepository.findAllByOrderByUpdatedAtDescIdDesc().stream()
                .map(this::toResponse)
                .filter(order -> normalizedOrderType.isBlank() || normalizedOrderType.equalsIgnoreCase(order.orderType()))
                .filter(order -> normalizedStatus.isBlank() || normalizedStatus.equalsIgnoreCase(order.status()))
                .filter(order -> matchesQuery(order, normalizedQuery))
                .toList();
    }

    @Transactional(readOnly = true)
    public VillaServiceBookingOrderResponse getBookingOrder(Long bookingId) {
        RoomBooking booking = findBooking(bookingId);
        VillaServiceOrderResponse order = villaServiceOrderRepository.findByOrderTypeAndBookingId(ORDER_TYPE_BOOKING, bookingId)
                .map(this::toResponse)
                .orElseGet(() -> buildDraftBookingOrder(booking));
        return new VillaServiceBookingOrderResponse(RoomBookingResponse.from(booking), order);
    }

    @Transactional
    public VillaServiceBookingOrderResponse saveBookingOrder(Long bookingId, VillaServiceOrderUpsertRequest request, User actor) {
        RoomBooking booking = findBooking(bookingId);
        VillaServiceOrder order = villaServiceOrderRepository.findByOrderTypeAndBookingId(ORDER_TYPE_BOOKING, bookingId)
                .orElseGet(VillaServiceOrder::new);
        boolean isNew = order.getId() == null;

        order.setOrderType(ORDER_TYPE_BOOKING);
        order.setStatus(STATUS_OPEN);
        order.setBookingId(booking.getId());
        order.setBookingRoomCode(booking.getRoomCode());
        order.setBookingGuestName(booking.getGuestName());
        order.setCustomerName(firstNonBlank(request.getCustomerName(), booking.getGuestName()));
        order.setCustomerPhone(firstNonBlank(request.getCustomerPhone(), booking.getPhone()));
        order.setServiceDate(request.getServiceDate());
        order.setNotes(normalizeText(request.getNotes()));
        order.setDepositAmount(VillaServicePricing.normalizeMoney(request.getDepositAmount()));
        order = villaServiceOrderRepository.save(order);

        List<VillaServiceOrderItem> savedItems = replaceOrderItems(order, request.getItems(), actor);
        double serviceTotal = VillaServicePricing.calculateOrderTotal(savedItems.stream().map(VillaServiceOrderItem::getLineTotal).toList());
        double vendorCostTotal = VillaServicePricing.calculateVendorCostTotal(savedItems.stream().map(VillaServiceOrderItem::getVendorCost).toList());
        order.setServiceTotal(serviceTotal);
        order.setVendorCostTotal(vendorCostTotal);
        order.setBookingBaseAmount(VillaServicePricing.normalizeMoney(booking.getVillaRate()));
        order.setFinalTotal(VillaServicePricing.calculateBookingTotal(booking.getVillaRate(), serviceTotal));
        order.setRemainingAmount(VillaServicePricing.calculateRemainingAmount(order.getFinalTotal(), order.getDepositAmount(), null));
        order = villaServiceOrderRepository.save(order);

        booking.setServiceTotal(serviceTotal);
        booking.setTotalAmount(order.getFinalTotal());
        booking.setRemainingAmount(VillaServicePricing.calculateRemainingAmount(
                order.getFinalTotal(),
                safeMoney(booking.getDepositAmount()) + safeMoney(order.getDepositAmount()),
                booking.getRemainingAmount()
        ));
        roomBookingRepository.save(booking);

        villaServiceCatalogService.log(
                TARGET_TYPE_ORDER,
                order.getId(),
                isNew ? "ORDER_CREATED" : "ORDER_UPDATED",
                actor,
                "Saved booking service order for " + booking.getRoomCode()
        );
        return new VillaServiceBookingOrderResponse(RoomBookingResponse.from(booking), toResponse(order));
    }

    @Transactional
    public VillaServiceOrderResponse createStandaloneOrder(VillaServiceOrderUpsertRequest request, User actor) {
        VillaServiceOrder order = new VillaServiceOrder();
        order.setOrderType(ORDER_TYPE_STANDALONE);
        order.setStatus(normalizeStandaloneStatus(request.getStatus()));
        order.setCustomerName(requireStandaloneCustomerName(request.getCustomerName()));
        order.setCustomerPhone(normalizeText(request.getCustomerPhone()));
        order.setServiceDate(requireServiceDate(request.getServiceDate()));
        order.setNotes(normalizeText(request.getNotes()));
        order.setDepositAmount(VillaServicePricing.normalizeMoney(request.getDepositAmount()));
        order = villaServiceOrderRepository.save(order);

        List<VillaServiceOrderItem> savedItems = replaceOrderItems(order, request.getItems(), actor);
        double serviceTotal = VillaServicePricing.calculateOrderTotal(savedItems.stream().map(VillaServiceOrderItem::getLineTotal).toList());
        double vendorCostTotal = VillaServicePricing.calculateVendorCostTotal(savedItems.stream().map(VillaServiceOrderItem::getVendorCost).toList());
        order.setServiceTotal(serviceTotal);
        order.setVendorCostTotal(vendorCostTotal);
        order.setBookingBaseAmount(null);
        order.setFinalTotal(serviceTotal <= 0.000001 ? null : serviceTotal);
        order.setRemainingAmount(VillaServicePricing.calculateRemainingAmount(order.getFinalTotal(), order.getDepositAmount(), null));
        order = villaServiceOrderRepository.save(order);

        villaServiceCatalogService.log(TARGET_TYPE_ORDER, order.getId(), "ORDER_CREATED", actor, "Created standalone service order");
        return toResponse(order);
    }

    @Transactional
    public VillaServiceOrderResponse updateStandaloneOrder(Long id, VillaServiceOrderUpsertRequest request, User actor) {
        VillaServiceOrder order = findStandaloneOrder(id);
        order.setStatus(normalizeStandaloneStatus(request.getStatus()));
        order.setCustomerName(requireStandaloneCustomerName(request.getCustomerName()));
        order.setCustomerPhone(normalizeText(request.getCustomerPhone()));
        order.setServiceDate(requireServiceDate(request.getServiceDate()));
        order.setNotes(normalizeText(request.getNotes()));
        order.setDepositAmount(VillaServicePricing.normalizeMoney(request.getDepositAmount()));
        order = villaServiceOrderRepository.save(order);

        List<VillaServiceOrderItem> savedItems = replaceOrderItems(order, request.getItems(), actor);
        double serviceTotal = VillaServicePricing.calculateOrderTotal(savedItems.stream().map(VillaServiceOrderItem::getLineTotal).toList());
        double vendorCostTotal = VillaServicePricing.calculateVendorCostTotal(savedItems.stream().map(VillaServiceOrderItem::getVendorCost).toList());
        order.setServiceTotal(serviceTotal);
        order.setVendorCostTotal(vendorCostTotal);
        order.setFinalTotal(serviceTotal <= 0.000001 ? null : serviceTotal);
        order.setRemainingAmount(VillaServicePricing.calculateRemainingAmount(order.getFinalTotal(), order.getDepositAmount(), null));
        order = villaServiceOrderRepository.save(order);

        villaServiceCatalogService.log(TARGET_TYPE_ORDER, order.getId(), "ORDER_UPDATED", actor, "Updated standalone service order");
        return toResponse(order);
    }

    @Transactional
    public VillaServiceOrderResponse updateOrderStatus(Long id, String status, User actor) {
        VillaServiceOrder order = villaServiceOrderRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service order not found"));
        String normalizedStatus = normalizeStandaloneStatus(status);
        order.setStatus(normalizedStatus);
        order = villaServiceOrderRepository.save(order);
        villaServiceCatalogService.log(TARGET_TYPE_ORDER, order.getId(), "STATUS_UPDATED", actor, "Updated service order status to " + normalizedStatus);
        return toResponse(order);
    }

    @Transactional
    public void deleteOrder(Long id, User actor) {
        VillaServiceOrder order = villaServiceOrderRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service order not found"));
        if (ORDER_TYPE_BOOKING.equalsIgnoreCase(order.getOrderType())) {
            if (order.getBookingId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking service order is missing booking reference");
            }

            RoomBooking booking = findBooking(order.getBookingId());
            Double bookingTotal = VillaServicePricing.calculateBookingTotal(booking.getVillaRate(), 0D);
            booking.setServiceTotal(0D);
            booking.setTotalAmount(bookingTotal);
            booking.setRemainingAmount(VillaServicePricing.calculateRemainingAmount(
                    bookingTotal,
                    booking.getDepositAmount(),
                    booking.getRemainingAmount()
            ));
            roomBookingRepository.save(booking);
        }

        villaServiceOrderItemRepository.deleteByOrderId(order.getId());
        villaServiceLogRepository.deleteByTargetTypeAndTargetId(TARGET_TYPE_ORDER, order.getId());
        villaServiceOrderRepository.delete(order);
    }

    @Transactional
    public void syncBookingOrderSummary(RoomBooking booking) {
        villaServiceOrderRepository.findByOrderTypeAndBookingId(ORDER_TYPE_BOOKING, booking.getId())
                .ifPresent(order -> {
                    order.setBookingRoomCode(booking.getRoomCode());
                    order.setBookingGuestName(booking.getGuestName());
                    order.setBookingBaseAmount(booking.getVillaRate());
                    order.setFinalTotal(booking.getTotalAmount());
                    order.setRemainingAmount(VillaServicePricing.calculateRemainingAmount(
                            booking.getTotalAmount(),
                            safeMoney(booking.getDepositAmount()) + safeMoney(order.getDepositAmount()),
                            order.getRemainingAmount()
                    ));
                    villaServiceOrderRepository.save(order);
                });
    }

    private List<VillaServiceOrderItem> replaceOrderItems(VillaServiceOrder order, List<VillaServiceOrderItemRequest> requestedItems, User actor) {
        List<VillaServiceOrderItemRequest> safeItems = requestedItems == null ? List.of() : requestedItems;
        Map<Long, VillaServiceOrderItem> existingByServiceId = villaServiceOrderItemRepository.findByOrderIdOrderByIdAsc(order.getId()).stream()
                .collect(LinkedHashMap::new, (map, item) -> map.put(item.getCatalogServiceId(), item), Map::putAll);

        validateNoDuplicateServices(safeItems);
        Map<Long, VillaServiceCatalog> catalogById = loadCatalogById(safeItems);

        List<VillaServiceOrderItem> nextItems = new ArrayList<>();
        for (VillaServiceOrderItemRequest requestedItem : safeItems) {
            VillaServiceCatalog catalog = catalogById.get(requestedItem.getServiceId());
            if (catalog == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Service does not exist");
            }
            if (!catalog.isActive()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Inactive service cannot be added to order");
            }

            VillaServiceVendor selectedVendor = resolveVendor(catalog, requestedItem.getVendorId());
            double unitPrice = requestedItem.getUnitPrice() != null
                    ? VillaServicePricing.normalizeMoney(requestedItem.getUnitPrice())
                    : safeMoney(catalog.getUnitPrice());
            int quantity = requestedItem.getQuantity() == null ? 0 : requestedItem.getQuantity();
            double lineTotal = unitPrice * quantity;
            double vendorCost = requestedItem.getVendorCost() == null ? 0D : VillaServicePricing.normalizeMoney(requestedItem.getVendorCost());

            VillaServiceOrderItem nextItem = new VillaServiceOrderItem();
            nextItem.setOrderId(order.getId());
            nextItem.setCatalogServiceId(catalog.getId());
            nextItem.setServiceName(catalog.getName());
            nextItem.setVendorId(selectedVendor == null ? null : selectedVendor.getId());
            nextItem.setVendorName(selectedVendor == null ? null : selectedVendor.getName());
            nextItem.setUnitPrice(unitPrice);
            nextItem.setQuantity(quantity);
            nextItem.setLineTotal(lineTotal);
            nextItem.setVendorCost(vendorCost);
            nextItems.add(nextItem);

            VillaServiceOrderItem existing = existingByServiceId.remove(catalog.getId());
            if (existing == null) {
                villaServiceCatalogService.log(
                        TARGET_TYPE_ORDER,
                        order.getId(),
                        "ITEM_ADDED",
                        actor,
                        "Added " + quantity + " x " + catalog.getName() + describeVendor(selectedVendor)
                );
            } else if (!existing.getQuantity().equals(quantity)
                    || !existing.getUnitPrice().equals(unitPrice)
                    || !safeMoney(existing.getVendorCost()).equals(vendorCost)
                    || !sameNullableLong(existing.getVendorId(), selectedVendor == null ? null : selectedVendor.getId())) {
                villaServiceCatalogService.log(
                        TARGET_TYPE_ORDER,
                        order.getId(),
                        "ITEM_UPDATED",
                        actor,
                        "Updated " + catalog.getName() + " from " + existing.getQuantity() + " to " + quantity
                );
            }
        }

        existingByServiceId.values().forEach(item ->
                villaServiceCatalogService.log(TARGET_TYPE_ORDER, order.getId(), "ITEM_REMOVED", actor, "Removed " + item.getServiceName())
        );

        villaServiceOrderItemRepository.deleteByOrderId(order.getId());
        if (!nextItems.isEmpty()) {
            return villaServiceOrderItemRepository.saveAll(nextItems);
        }
        return List.of();
    }

    private Map<Long, VillaServiceCatalog> loadCatalogById(List<VillaServiceOrderItemRequest> requestedItems) {
        Set<Long> ids = requestedItems.stream()
                .map(VillaServiceOrderItemRequest::getServiceId)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        return villaServiceCatalogRepository.findAllById(ids).stream()
                .collect(LinkedHashMap::new, (map, item) -> map.put(item.getId(), item), Map::putAll);
    }

    private void validateNoDuplicateServices(List<VillaServiceOrderItemRequest> requestedItems) {
        Set<Long> ids = new LinkedHashSet<>();
        for (VillaServiceOrderItemRequest item : requestedItems) {
            if (item.getServiceId() == null) {
                continue;
            }
            if (!ids.add(item.getServiceId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Duplicate service lines are not allowed");
            }
        }
    }

    private VillaServiceOrderResponse buildDraftBookingOrder(RoomBooking booking) {
        Double serviceTotal = booking.getServiceTotal() == null ? 0D : booking.getServiceTotal();
        Double finalTotal = booking.getTotalAmount() != null
                ? booking.getTotalAmount()
                : VillaServicePricing.calculateBookingTotal(booking.getVillaRate(), serviceTotal);
        return new VillaServiceOrderResponse(
                null,
                ORDER_TYPE_BOOKING,
                STATUS_OPEN,
                booking.getId(),
                booking.getRoomCode(),
                booking.getGuestName(),
                booking.getGuestName(),
                booking.getPhone(),
                booking.getCheckInAt() == null ? null : booking.getCheckInAt().toLocalDate(),
                "",
                serviceTotal,
                0D,
                null,
                VillaServicePricing.calculateRemainingAmount(finalTotal, null, null),
                booking.getVillaRate(),
                finalTotal,
                null,
                null,
                List.of()
        );
    }

    private VillaServiceOrderResponse toResponse(VillaServiceOrder order) {
        List<VillaServiceOrderItemResponse> items = villaServiceOrderItemRepository.findByOrderIdOrderByIdAsc(order.getId()).stream()
                .map(VillaServiceOrderItemResponse::from)
                .toList();

        return new VillaServiceOrderResponse(
                order.getId(),
                order.getOrderType(),
                order.getStatus(),
                order.getBookingId(),
                order.getBookingRoomCode(),
                order.getBookingGuestName(),
                order.getCustomerName(),
                order.getCustomerPhone(),
                order.getServiceDate(),
                order.getNotes(),
                order.getServiceTotal(),
                order.getVendorCostTotal(),
                order.getDepositAmount(),
                order.getRemainingAmount(),
                order.getBookingBaseAmount(),
                order.getFinalTotal(),
                order.getCreatedAt(),
                order.getUpdatedAt(),
                items
        );
    }

    private boolean matchesQuery(VillaServiceOrderResponse order, String query) {
        if (query.isBlank()) {
            return true;
        }
        String haystack = String.join(
                " ",
                safe(order.bookingRoomCode()),
                safe(order.bookingGuestName()),
                safe(order.customerName()),
                safe(order.customerPhone()),
                safe(order.notes()),
                order.items().stream().map(VillaServiceOrderItemResponse::serviceName).reduce("", (left, right) -> left + " " + right)
        ).toLowerCase(Locale.ROOT);
        return haystack.contains(query);
    }

    private RoomBooking findBooking(Long bookingId) {
        return roomBookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
    }

    private VillaServiceOrder findStandaloneOrder(Long id) {
        VillaServiceOrder order = villaServiceOrderRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service order not found"));
        if (!ORDER_TYPE_STANDALONE.equalsIgnoreCase(order.getOrderType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only standalone orders can be edited here");
        }
        return order;
    }

    private String requireStandaloneCustomerName(String customerName) {
        String normalized = normalizeText(customerName);
        if (normalized.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Customer name is required");
        }
        return normalized;
    }

    private java.time.LocalDate requireServiceDate(java.time.LocalDate serviceDate) {
        if (serviceDate == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Service date is required");
        }
        return serviceDate;
    }

    private String normalizeStandaloneStatus(String status) {
        String normalized = normalizeFilter(status).toUpperCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return STATUS_OPEN;
        }
        if (STATUS_OPEN.equals(normalized) || STATUS_COMPLETED.equals(normalized) || STATUS_CANCELLED.equals(normalized)) {
            return normalized;
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid service order status");
    }

    private String normalizeFilter(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim();
    }

    private String firstNonBlank(String preferred, String fallback) {
        String normalizedPreferred = normalizeText(preferred);
        return normalizedPreferred.isBlank() ? normalizeText(fallback) : normalizedPreferred;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private Double safeMoney(Double value) {
        return value == null ? 0D : value;
    }

    private VillaServiceVendor resolveVendor(VillaServiceCatalog catalog, Long vendorId) {
        if (vendorId == null) {
            return null;
        }
        return catalog.getVendors().stream()
                .filter(vendor -> vendorId.equals(vendor.getId()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vendor is not linked to selected service"));
    }

    private String describeVendor(VillaServiceVendor vendor) {
        return vendor == null ? "" : " (" + vendor.getName() + ")";
    }

    private boolean sameNullableLong(Long left, Long right) {
        return left == null ? right == null : left.equals(right);
    }
}
