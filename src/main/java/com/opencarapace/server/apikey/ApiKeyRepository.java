package com.opencarapace.server.apikey;

import com.opencarapace.server.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ApiKeyRepository extends JpaRepository<ApiKey, Long> {

    List<ApiKey> findByUserAndActiveIsTrue(User user);

    Optional<ApiKey> findByKeyHashAndActiveIsTrue(String keyHash);
}

