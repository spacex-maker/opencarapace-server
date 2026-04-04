package com.opencarapace.server.securityscan;

import java.util.Locale;

/**
 * 安全扫描输出语言：与桌面端 {@code oc_locale} 对齐（zh / en / es / fr / de / pt / ru / ja / hi / ar）。
 */
public final class SecurityScanLocale {

    private SecurityScanLocale() {}

    /**
     * 规范化 UI 语言码；空或无法识别时默认中文（与桌面默认一致）。
     */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return "zh";
        }
        String s = raw.trim().toLowerCase(Locale.ROOT);
        int u = s.indexOf('_');
        if (u > 0) {
            s = s.substring(0, u);
        }
        int d = s.indexOf('-');
        if (d > 0) {
            s = s.substring(0, d);
        }
        return switch (s) {
            case "zh", "en", "es", "fr", "de", "pt", "ru", "ja", "hi", "ar" -> s;
            default -> "en";
        };
    }

    /**
     * 追加在 systemPrompt 末尾，约束模型输出 findings 的自然语言字段语言。
     */
    public static String outputLanguageDirective(String lang) {
        return switch (lang) {
            case "zh" -> """

                    【输出语言】findings 中每条记录的 title、detail、remediation、location 必须使用自然、专业的简体中文撰写（JSON 键名与 severity 取值保持英文枚举不变）。
                    """;
            case "en" -> """

                    [Output language] Write title, detail, remediation, and location for EVERY finding in clear, professional English (keep JSON keys and severity enum values unchanged).
                    """;
            case "ja" -> """

                    【出力言語】各 finding の title、detail、remediation、location は自然で分かりやすい日本語で書くこと（JSON のキー名と severity の値はそのまま英語）。
                    """;
            case "es" -> """

                    [Idioma de salida] Redacta title, detail, remediation y location de CADA hallazgo en español claro y profesional (mantén las claves JSON y los valores severity en inglés).
                    """;
            case "fr" -> """

                    [Langue de sortie] Rédige title, detail, remediation et location pour CHAQUE finding en français clair et professionnel (conserve les clés JSON et les valeurs severity en anglais).
                    """;
            case "de" -> """

                    [Ausgabesprache] Schreibe title, detail, remediation und location für JEDEN Befund in klarem, professionellem Deutsch (JSON-Schlüssel und severity-Werte bleiben englisch).
                    """;
            case "pt" -> """

                    [Idioma de saída] Escreva title, detail, remediation e location de CADA achado em português claro e profissional (mantenha as chaves JSON e os valores severity em inglês).
                    """;
            case "ru" -> """

                    [Язык вывода] Пиши title, detail, remediation и location для КАЖДОГО finding на понятном профессиональном русском (ключи JSON и значения severity оставь на английском).
                    """;
            case "hi" -> """

                    [Output language] प्रत्येक finding के लिए title, detail, remediation और location स्पष्ट, पेशेवर हिंदी में लिखें (JSON की कुंजियाँ और severity मान अंग्रेज़ी में रखें)।
                    """;
            case "ar" -> """

                    [لغة المخرجات] اكتب title و detail و remediation و location لكل finding بالعربية الفصحى الواضحة والمهنية (أبقِ مفاتيح JSON وقيم severity بالإنجليزية).
                    """;
            default -> """

                    [Output language] Write title, detail, remediation, and location for EVERY finding in clear, professional English (keep JSON keys and severity values unchanged).
                    """;
        };
    }

}
