package com.example.gateway.repo;

import com.example.gateway.domain.ConcessionApplication;
import com.example.gateway.domain.ConcessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ConcessionApplicationRepository extends JpaRepository<ConcessionApplication, Long> {
    List<ConcessionApplication> findByPnrOrderByIdDesc(String pnr);

    List<ConcessionApplication> findByUserIdOrderByIdDesc(Integer userId);

    List<ConcessionApplication> findByStatusOrderByIdDesc(ConcessionStatus status);

    boolean existsByPassengerIdAndStatusNot(Integer passengerId, ConcessionStatus status);
}
