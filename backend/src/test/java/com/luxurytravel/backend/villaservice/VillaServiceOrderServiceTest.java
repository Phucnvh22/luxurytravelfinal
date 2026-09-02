package com.luxurytravel.backend.villaservice;

import com.luxurytravel.backend.roombooking.RoomBooking;
import com.luxurytravel.backend.roombooking.RoomBookingRepository;
import com.luxurytravel.backend.user.Role;
import com.luxurytravel.backend.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VillaServiceOrderServiceTest {
    @Mock
    private VillaServiceOrderRepository villaServiceOrderRepository;
    @Mock
    private VillaServiceOrderItemRepository villaServiceOrderItemRepository;
    @Mock
    private VillaServiceCatalogRepository villaServiceCatalogRepository;
    @Mock
    private VillaServiceVendorRepository villaServiceVendorRepository;
    @Mock
    private VillaServiceLogRepository villaServiceLogRepository;
    @Mock
    private RoomBookingRepository roomBookingRepository;

    private VillaServiceOrderService villaServiceOrderService;
    private VillaServiceCatalogService villaServiceCatalogService;

    @BeforeEach
    void setUp() {
        villaServiceCatalogService = new VillaServiceCatalogService(
                villaServiceCatalogRepository,
                villaServiceVendorRepository,
                villaServiceOrderItemRepository,
                villaServiceLogRepository
        );
        villaServiceOrderService = new VillaServiceOrderService(
                villaServiceOrderRepository,
                villaServiceOrderItemRepository,
                villaServiceCatalogRepository,
                villaServiceCatalogService,
                villaServiceLogRepository,
                roomBookingRepository
        );
    }

    @Test
    void saveBookingOrderUpdatesBookingTotals() {
        RoomBooking booking = new RoomBooking();
        booking.setId(7L);
        booking.setRoomCode("V107");
        booking.setGuestName("Alex");
        booking.setPhone("0909");
        booking.setVillaRate(5_000_000D);
        booking.setDepositAmount(1_000_000D);
        booking.setRemainingAmount(4_000_000D);

        VillaServiceCatalog catalog = new VillaServiceCatalog();
        catalog.setId(11L);
        catalog.setName("Airport transfer");
        catalog.setUnitPrice(300_000D);
        catalog.setActive(true);

        VillaServiceOrderUpsertRequest request = new VillaServiceOrderUpsertRequest();
        request.setCustomerName("Alex");
        request.setCustomerPhone("0909");
        request.setServiceDate(LocalDate.of(2026, 9, 3));
        request.setDepositAmount(200_000D);
        request.setNotes("Late arrival");

        VillaServiceOrderItemRequest itemRequest = new VillaServiceOrderItemRequest();
        itemRequest.setServiceId(11L);
        itemRequest.setQuantity(2);
        itemRequest.setUnitPrice(350_000D);
        itemRequest.setVendorCost(400_000D);
        request.setItems(List.of(itemRequest));

        User actor = new User("admin", "pass", "Admin", Role.ADMIN);

        AtomicLong orderIdSequence = new AtomicLong(100L);
        AtomicReference<List<VillaServiceOrderItem>> savedItems = new AtomicReference<>(new ArrayList<>());

        when(roomBookingRepository.findById(7L)).thenReturn(Optional.of(booking));
        when(villaServiceOrderRepository.findByOrderTypeAndBookingId("BOOKING", 7L)).thenReturn(Optional.empty());
        when(villaServiceCatalogRepository.findAllById(any())).thenReturn(List.of(catalog));
        when(villaServiceOrderItemRepository.findByOrderIdOrderByIdAsc(anyLong())).thenAnswer(invocation -> savedItems.get());
        when(villaServiceOrderRepository.save(any(VillaServiceOrder.class))).thenAnswer(invocation -> {
            VillaServiceOrder order = invocation.getArgument(0);
            if (order.getId() == null) {
                order.setId(orderIdSequence.getAndIncrement());
            }
            return order;
        });
        when(villaServiceOrderItemRepository.saveAll(any())).thenAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            List<VillaServiceOrderItem> items = new ArrayList<>((List<VillaServiceOrderItem>) invocation.getArgument(0));
            long itemId = 1L;
            for (VillaServiceOrderItem item : items) {
                item.setId(itemId++);
            }
            savedItems.set(items);
            return items;
        });
        when(roomBookingRepository.save(any(RoomBooking.class))).thenAnswer(invocation -> invocation.getArgument(0));
        VillaServiceBookingOrderResponse response = villaServiceOrderService.saveBookingOrder(7L, request, actor);

        assertNotNull(response.order().id());
        assertEquals(LocalDate.of(2026, 9, 3), response.order().serviceDate());
        assertEquals(700_000D, response.order().serviceTotal());
        assertEquals(400_000D, response.order().vendorCostTotal());
        assertEquals(200_000D, response.order().depositAmount());
        assertEquals(5_500_000D, response.order().remainingAmount());
        assertEquals(5_700_000D, response.order().finalTotal());
        assertEquals(700_000D, response.booking().serviceTotal());
        assertEquals(5_700_000D, response.booking().totalAmount());
        assertEquals(4_500_000D, response.booking().remainingAmount());

        ArgumentCaptor<RoomBooking> bookingCaptor = ArgumentCaptor.forClass(RoomBooking.class);
        verify(roomBookingRepository).save(bookingCaptor.capture());
        assertEquals(700_000D, bookingCaptor.getValue().getServiceTotal());
        assertEquals(5_700_000D, bookingCaptor.getValue().getTotalAmount());
        assertEquals(4_500_000D, bookingCaptor.getValue().getRemainingAmount());
    }

    @Test
    void deleteOrderRemovesBookingOrderAndRestoresBookingTotals() {
        RoomBooking booking = new RoomBooking();
        booking.setId(7L);
        booking.setRoomCode("V107");
        booking.setGuestName("Alex");
        booking.setVillaRate(5_000_000D);
        booking.setDepositAmount(1_000_000D);
        booking.setServiceTotal(700_000D);
        booking.setTotalAmount(5_700_000D);
        booking.setRemainingAmount(4_500_000D);

        VillaServiceOrder order = new VillaServiceOrder();
        order.setId(100L);
        order.setOrderType("BOOKING");
        order.setBookingId(7L);
        order.setServiceTotal(700_000D);
        order.setDepositAmount(200_000D);

        User actor = new User("admin", "pass", "Admin", Role.ADMIN);

        when(villaServiceOrderRepository.findById(100L)).thenReturn(Optional.of(order));
        when(roomBookingRepository.findById(7L)).thenReturn(Optional.of(booking));
        when(roomBookingRepository.save(any(RoomBooking.class))).thenAnswer(invocation -> invocation.getArgument(0));

        villaServiceOrderService.deleteOrder(100L, actor);

        ArgumentCaptor<RoomBooking> bookingCaptor = ArgumentCaptor.forClass(RoomBooking.class);
        verify(roomBookingRepository).save(bookingCaptor.capture());
        assertEquals(0D, bookingCaptor.getValue().getServiceTotal());
        assertEquals(5_000_000D, bookingCaptor.getValue().getTotalAmount());
        assertEquals(4_000_000D, bookingCaptor.getValue().getRemainingAmount());

        verify(villaServiceOrderItemRepository).deleteByOrderId(100L);
        verify(villaServiceLogRepository).deleteByTargetTypeAndTargetId("ORDER", 100L);
        verify(villaServiceOrderRepository).delete(order);
    }

    @Test
    void deleteOrderRemovesStandaloneOrderWithoutTouchingBookingTotals() {
        VillaServiceOrder order = new VillaServiceOrder();
        order.setId(101L);
        order.setOrderType("STANDALONE");

        User actor = new User("admin", "pass", "Admin", Role.ADMIN);

        when(villaServiceOrderRepository.findById(101L)).thenReturn(Optional.of(order));

        villaServiceOrderService.deleteOrder(101L, actor);

        verify(villaServiceOrderItemRepository).deleteByOrderId(101L);
        verify(villaServiceLogRepository).deleteByTargetTypeAndTargetId("ORDER", 101L);
        verify(villaServiceOrderRepository).delete(order);
    }
}
