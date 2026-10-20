package com.example.gateway.repo;

import com.example.gateway.domain.Payment;
import com.example.gateway.domain.PaymentStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByRazorpayOrderId(String razorpayOrderId);

    /** Locks the payment row, so the verify call and the webhook process an order one at a time. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Payment> findForUpdateByRazorpayOrderId(String razorpayOrderId);

    Optional<Payment> findFirstByPnrAndStatusOrderByIdDesc(String pnr, PaymentStatus status);

    Optional<Payment> findFirstByPnrAndStatusInOrderByIdDesc(String pnr, List<PaymentStatus> statuses);

    List<Payment> findByPnrOrderByIdDesc(String pnr);

    List<Payment> findByUserIdOrderByIdDesc(Integer userId);
}
