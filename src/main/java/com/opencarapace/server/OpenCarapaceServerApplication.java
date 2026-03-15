package com.opencarapace.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class OpenCarapaceServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(OpenCarapaceServerApplication.class, args);
    }
}

