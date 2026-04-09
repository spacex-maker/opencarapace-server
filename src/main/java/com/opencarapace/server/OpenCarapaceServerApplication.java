package com.opencarapace.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class OpenCarapaceServerApplication {

    /**
     * 在 main 之前执行：Mac 上 Clash/系统代理常把 {@code socksProxyHost} 注入 JVM；关软件后端口没了会
     * {@code SocksSocketImpl Connection refused}。MySQL 必须直连，不能走 SOCKS。
     * 若库只可通过 SOCKS 访问，启动加 {@code -Dopencarapace.mysql.useJvmSocks=true}。
     */
    static {
        if (!Boolean.parseBoolean(System.getProperty("opencarapace.mysql.useJvmSocks", "false"))) {
            for (String key :
                    new String[] {
                        "http.proxyHost",
                        "http.proxyPort",
                        "https.proxyHost",
                        "https.proxyPort",
                        "socksProxyHost",
                        "socksProxyPort",
                        "socksProxyVersion",
                    }) {
                System.clearProperty(key);
            }
            System.setProperty("java.net.useSystemProxies", "false");
        }
    }

    public static void main(String[] args) {
        SpringApplication.run(OpenCarapaceServerApplication.class, args);
    }
}
