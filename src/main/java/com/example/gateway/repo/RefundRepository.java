package com.example.gateway.repo;

import com.example.gateway.domain.Refund;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RefundRepository extends JpaRepository<Refund, Long> {
    Optional<Refund> findByRazorpayRefundId(String razorpayRefundId);

    List<Refund> findByBookingIdOrderByIdDesc(Long bookingId);

    List<Refund> findByUserIdOrderByIdDesc(Integer userId);
}
