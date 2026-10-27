package com.railway.team6;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/*
 * The starting point of the whole backend.
 *
 * @SpringBootApplication tells Spring to:
 *   1. scan this package (com.railway.team6) and every sub-package for our classes
 *      (@RestController, @Service, repositories, ...),
 *   2. create one object of each and connect them together ("dependency injection"),
 *   3. auto-configure things it finds on the classpath (Tomcat web server, MongoDB connection).
 *
 * Folder layout (one folder per feature):
 *   notification/  -> receive notifications from other teams, list them for users (bell icon)
 *   feedback/      -> star-rating feedback form, opened after a JOURNEY_COMPLETED notification
 */
@SpringBootApplication
public class Team6Application {

    public static void main(String[] args) {
        // Starts the web server on the port in application.properties (8086) and keeps running.
        SpringApplication.run(Team6Application.class, args);
    }
}
