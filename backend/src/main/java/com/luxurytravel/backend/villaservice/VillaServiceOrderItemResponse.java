package com.luxurytravel.backend.villaservice;

public record VillaServiceOrderItemResponse(
        Long id,
        Long serviceId,
        String serviceName,
        Long vendorId,
        String vendorName,
        Double unitPrice,
        Integer quantity,
        Double lineTotal,
        Double vendorCost
) {
    public static VillaServiceOrderItemResponse from(VillaServiceOrderItem item) {
        return new VillaServiceOrderItemResponse(
                item.getId(),
                item.getCatalogServiceId(),
                item.getServiceName(),
                item.getVendorId(),
                item.getVendorName(),
                item.getUnitPrice(),
                item.getQuantity(),
                item.getLineTotal(),
                item.getVendorCost()
        );
    }
}
