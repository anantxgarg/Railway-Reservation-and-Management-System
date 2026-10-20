package com.example.gateway.repo;

import com.example.gateway.domain.ConcessionApplication;
import com.example.gateway.domain.ConcessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConcessionApplicationRepository extends JpaRepository<ConcessionApplication, Long> {
    Optional<ConcessionApplication> findByBookingId(Long bookingId);

    List<ConcessionApplication> findByUserIdOrderByIdDesc(Integer userId);

    List<ConcessionApplication> findByStatusOrderByIdDesc(ConcessionStatus status);
}
