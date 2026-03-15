package com.opencarapace.server.danger;

import com.opencarapace.server.danger.DangerCommand.DangerCategory;
import com.opencarapace.server.danger.DangerCommand.RiskLevel;
import com.opencarapace.server.danger.DangerCommand.SystemType;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DangerCommandService {

    private final DangerCommandRepository repository;

    @Transactional(readOnly = true)
    public Page<DangerCommand> search(SystemType systemType, DangerCategory category,
                                      RiskLevel riskLevel, String keyword, Pageable pageable) {
        return repository.search(systemType, category, riskLevel, keyword, pageable);
    }

    @Transactional(readOnly = true)
    public Optional<DangerCommand> findById(Long id) {
        return repository.findById(id);
    }

    @Transactional
    public DangerCommand create(DangerCommand command) {
        return repository.save(command);
    }

    @Transactional
    public Optional<DangerCommand> update(Long id, DangerCommand updates) {
        return repository.findById(id)
                .map(existing -> {
                    existing.setCommandPattern(updates.getCommandPattern());
                    existing.setSystemType(updates.getSystemType());
                    existing.setCategory(updates.getCategory());
                    existing.setRiskLevel(updates.getRiskLevel());
                    existing.setTitle(updates.getTitle());
                    existing.setDescription(updates.getDescription());
                    existing.setMitigation(updates.getMitigation());
                    existing.setTags(updates.getTags());
                    existing.setEnabled(updates.isEnabled());
                    return repository.save(existing);
                });
    }

    @Transactional
    public boolean deleteById(Long id) {
        if (!repository.existsById(id)) return false;
        repository.deleteById(id);
        return true;
    }
}
