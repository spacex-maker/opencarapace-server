# GitHub Actions 后端部署说明

`.github/workflows/backend-deploy.yml` 会在 `main` 分支 push 后自动执行，也支持在 GitHub Actions 页面手动触发。

流水线行为：

1. 使用 Temurin Java 17。
2. 通过 `.github/workflows/backend-deploy.yml` 顶部的 `APP_VERSION` 和 `APP_SNAPSHOT` 计算构建版本。
3. 使用 `versions-maven-plugin` 在 CI 临时设置 Maven 项目版本。
4. 执行 `mvn -B clean package` 构建 Spring Boot 可执行 Jar。
5. 将产物命名为 `opencarapace-server-<version>.jar` 并保留 7 天 artifact。
6. 通过 SSH 上传到服务器部署目录。
7. 在 GitHub Actions 内联远程脚本中完成启停：停止旧进程，清理旧 Jar，启动新 Jar 并输出 PID。

## 版本配置

在 `.github/workflows/backend-deploy.yml` 顶部修改：

```yaml
env:
  JAVA_VERSION: "17"
  APP_BASE_NAME: opencarapace-server
  APP_VERSION: "0.0.1"
  APP_SNAPSHOT: "true"
  RUNTIME_JAR_NAME: opencarapace-server.jar
  SYSTEMD_SERVICE: opencarapace-server
  SYSTEMD_JVM_OPTS: "-Xms256m -Xmx512m -XX:+UseG1GC"
  HEALTHCHECK_URL: "http://127.0.0.1:8080/actuator/health"
  HEALTHCHECK_TIMEOUT_SECONDS: "60"
  HEALTHCHECK_INTERVAL_SECONDS: "2"
```

`APP_SNAPSHOT: "true"` 时，构建版本为 `0.0.1-SNAPSHOT`，Jar 名称为 `opencarapace-server-0.0.1-SNAPSHOT.jar`。

`APP_SNAPSHOT: "false"` 时，构建版本为 `0.0.1`，Jar 名称为 `opencarapace-server-0.0.1.jar`。

部署脚本会把构建产物直接部署为 `DEPLOY_PATH/RUNTIME_JAR_NAME`，默认路径是 `/home/ubuntu/opencarapace-server.jar`，不使用软链接。重启前会修正部署目录和 Jar 权限，并验证服务用户能读取该 Jar。若 `${SYSTEMD_SERVICE}.service` 不存在，CI 会首次创建 systemd unit；若已存在，会覆盖为当前工作流配置。之后执行 `systemctl enable` 和 `systemctl restart`。重启后会轮询 `HEALTHCHECK_URL`，直到返回 HTTP `200` 才认为发布成功。默认使用 Spring Boot Actuator 的 `/actuator/health`，该路径已在后端安全配置中放行。如果生产环境改了端口、上下文路径，或想使用其他公开接口，直接修改 `HEALTHCHECK_URL`。

## GitHub Secrets

在仓库 `Settings -> Secrets and variables -> Actions` 中配置：

| Secret | 必填 | 说明 |
| --- | --- | --- |
| `DEPLOY_HOST` | 是 | 服务器 IP 或域名 |
| `DEPLOY_USER` | 是 | SSH 登录用户 |
| `DEPLOY_SSH_KEY` | 是 | SSH 私钥内容，对应公钥需加入服务器 `~/.ssh/authorized_keys` |
| `DEPLOY_PATH` | 否 | 服务器上的部署目录，未配置时默认 `/home/ubuntu` |
| `DEPLOY_PORT` | 否 | SSH 端口，未配置时默认 `22` |

## 服务器前置条件

`DEPLOY_USER` 需要能够创建并写入 `DEPLOY_PATH`。未配置 `DEPLOY_PATH` 时部署到 `/home/ubuntu`。该用户还需要能停止自己启动的旧 `java -jar` 进程，并具备对 `systemctl`、`journalctl` 和写入 `/etc/systemd/system/*.service` 的免密 sudo 权限。服务器还需要安装可运行 Spring Boot 3 的 Java 17、`curl` 和 systemd：

```bash
java -version
curl --version
systemctl --version
```

首次配置示例：

```bash
sudo mkdir -p /home/ubuntu
sudo chown -R ubuntu:ubuntu /home/ubuntu
```

CI 首次部署时会自动生成类似下面的 systemd unit：

```ini
[Unit]
Description=OpenCarapace Server
After=network.target

[Service]
User=deploy
WorkingDirectory=/home/ubuntu
ExecStart=/usr/bin/java -Xms256m -Xmx512m -XX:+UseG1GC -jar /home/ubuntu/opencarapace-server.jar
SuccessExitStatus=143
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable opencarapace-server
sudo systemctl start opencarapace-server
```

如果这些分支都部署到同一台服务器，后推送的分支会覆盖先前部署的版本。工作流已用 `concurrency` 串行化部署，避免多个分支同时改同一个部署目录。
