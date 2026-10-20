package com.example.gateway.repo;

import com.example.gateway.domain.Payment;
import com.example.gateway.domain.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByRazorpayOrderId(String razorpayOrderId);

    Optional<Payment> findFirstByBookingIdAndStatus(Long bookingId, PaymentStatus status);

    List<Payment> findByBookingIdOrderByIdDesc(Long bookingId);

    List<Payment> findByUserIdOrderByIdDesc(Integer userId);
}
