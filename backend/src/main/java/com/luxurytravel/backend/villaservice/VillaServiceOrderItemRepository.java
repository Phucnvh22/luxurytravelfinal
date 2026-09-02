package com.luxurytravel.backend.villaservice;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface VillaServiceOrderItemRepository extends JpaRepository<VillaServiceOrderItem, Long> {
    List<VillaServiceOrderItem> findByOrderIdOrderByIdAsc(Long orderId);

    void deleteByOrderId(Long orderId);

    @Query("""
            select item.catalogServiceId, count(item)
            from VillaServiceOrderItem item
            group by item.catalogServiceId
            """)
    List<Object[]> countUsageByCatalogServiceId();
}
