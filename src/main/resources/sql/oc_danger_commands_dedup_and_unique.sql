-- 已有表去重并添加唯一约束（仅当表已存在且尚无 uk_danger_commands_pattern_system 时执行）
-- 步骤 1：若存在 (command_pattern, system_type) 重复，先执行下面 DELETE，保留 id 最小的一条
-- 步骤 2：再执行 ALTER 添加唯一约束；若报 Duplicate entry，说明仍有重复，回到步骤 1

-- 去重：每组 (command_pattern, system_type) 只保留 id 最小的行
DELETE t1 FROM oc_danger_commands t1
INNER JOIN oc_danger_commands t2
  ON t1.command_pattern = t2.command_pattern AND t1.system_type = t2.system_type AND t1.id > t2.id;

-- 添加唯一约束
ALTER TABLE oc_danger_commands
  ADD UNIQUE KEY uk_danger_commands_pattern_system (command_pattern, system_type);
