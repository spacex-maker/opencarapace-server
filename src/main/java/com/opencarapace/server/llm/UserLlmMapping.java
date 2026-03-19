package com.opencarapace.server.llm;

import com.opencarapace.server.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "oc_user_llm_mappings", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "prefix"})
})
@Getter
@Setter
public class UserLlmMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 128)
    private String prefix;

    @Column(nullable = false, length = 512)
    private String targetBase;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;
}
