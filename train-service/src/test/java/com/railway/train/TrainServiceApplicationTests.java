package com.railway.train;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class TrainServiceApplicationTests {

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Test
	void contextLoads() {
		assertNotNull(jdbcTemplate, "JdbcTemplate should be loaded");
	}

	@Test
	void verifyNeonDatabaseConnection() {
		Integer trainCount = jdbcTemplate.queryForObject("SELECT count(*) FROM train", Integer.class);
		System.out.println("=================================================");
		System.out.println(">>> NEON DB VERIFICATION SUCCESSFUL! <<<");
		System.out.println(">>> Live train records found in Neon DB: " + trainCount);
		System.out.println("=================================================");
		assertNotNull(trainCount);
		assertTrue(trainCount > 0, "Expected at least 1 record in train table");
	}
}
