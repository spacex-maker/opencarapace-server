package com.opencarapace.server.config;

import com.opencarapace.server.config.entity.SystemConfig;
import com.opencarapace.server.config.entity.SystemConfigRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SystemDataVersionService {

    private final SystemConfigRepository systemConfigRepository;

    public SystemDataVersionService(SystemConfigRepository systemConfigRepository) {
        this.systemConfigRepository = systemConfigRepository;
    }

    @Transactional
    public void incrementSkillsDataVersion() {
        SystemConfig config = systemConfigRepository
                .findByConfigKey(SystemConfig.KEY_SKILLS_DATA_VERSION)
                .orElseGet(() -> {
                    SystemConfig c = new SystemConfig();
                    c.setConfigKey(SystemConfig.KEY_SKILLS_DATA_VERSION);
                    c.setConfigValue("0");
                    c.setDescription("Skills 系统数据版本号");
                    return c;
                });
        long current = parseLong(config.getConfigValue());
        config.setConfigValue(String.valueOf(current + 1));
        systemConfigRepository.save(config);
    }

    @Transactional
    public void incrementDangerCommandsDataVersion() {
        SystemConfig config = systemConfigRepository
                .findByConfigKey(SystemConfig.KEY_DANGER_COMMANDS_DATA_VERSION)
                .orElseGet(() -> {
                    SystemConfig c = new SystemConfig();
                    c.setConfigKey(SystemConfig.KEY_DANGER_COMMANDS_DATA_VERSION);
                    c.setConfigValue("0");
                    c.setDescription("危险指令系统数据版本号");
                    return c;
                });
        long current = parseLong(config.getConfigValue());
        config.setConfigValue(String.valueOf(current + 1));
        systemConfigRepository.save(config);
    }

    public long getSkillsDataVersion() {
        return systemConfigRepository
                .findByConfigKey(SystemConfig.KEY_SKILLS_DATA_VERSION)
                .map(c -> parseLong(c.getConfigValue()))
                .orElse(0L);
    }

    public long getDangerCommandsDataVersion() {
        return systemConfigRepository
                .findByConfigKey(SystemConfig.KEY_DANGER_COMMANDS_DATA_VERSION)
                .map(c -> parseLong(c.getConfigValue()))
                .orElse(0L);
    }

    private long parseLong(String value) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return 0L;
        }
    }
}
