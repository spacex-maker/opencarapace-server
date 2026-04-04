/** 设置页文案结构 */
export interface SettingsPageMessages {
  intro: string;
  tabs: { general: string; docs: string };
  llm: {
    sectionTitle: string;
    sectionDesc: string;
    gatewayTitle: string;
    gatewayDesc: string;
    directTitle: string;
    directDesc: string;
    badgeCurrent: string;
  };
  loadingConfig: string;
  state: { on: string; off: string };
  skills: {
    title: string;
    desc: string;
    detailOn: string;
    detailOff: string;
  };
  dangers: {
    title: string;
    desc: string;
    detailOn: string;
    detailOff: string;
  };
  mappingSync: {
    title: string;
    desc: string;
    detailOn: string;
    detailOff: string;
    pull: string;
    pulling: string;
    pullHint: string;
  };
  networkMap: {
    title: string;
    body: string;
  };
  mappingForm: {
    phPrefix: string;
    phTarget: string;
    addOrUpdate: string;
  };
  mappingTable: {
    loading: string;
    empty: string;
    colPrefix: string;
    colTarget: string;
    colGw: string;
    gwHint: string;
    delete: string;
  };
  advanced: {
    title: string;
    desc: string;
    testTitle: string;
    currentApi: string;
    toggleOn: string;
    toggleOff: string;
  };
  account: {
    title: string;
    hint: string;
  };
  err: {
    loadRoute: string;
    toggleTest: string;
    save: string;
    prefixTarget: string;
    saveMapping: string;
    delMapping: string;
    syncToggle: string;
    loginFirst: string;
    cloudFetch: string;
    cloudNotJson: string;
    cloudBadShape: string;
  };
  toast: {
    testOn: string;
    testOff: string;
    routeOk: string;
    mapLocalCloudFail: string;
    mapCloudOk: string;
    mapLocalOk: string;
    mapDeleted: string;
    skillsOn: string;
    skillsOff: string;
    dangersOn: string;
    dangersOff: string;
    mapSyncOn: string;
    mapSyncOff: string;
    syncedFromCloud: string;
  };
}

/** 安全扫描页文案 */
export interface SecurityScanPageMessages {
  title: string;
  introP1: string;
  introP2BeforeCode: string;
  introP2AfterCode: string;
  refreshConfig: string;
  runDeepScan: string;
  scanning: string;
  scanDisabledNoItems: string;
  tabs: { items: string; results: string; history: string };
  scanStatusRunning: string;
  scanStatusReady: string;
  scanHintSelectItems: string;
  stats: { critical: string; warning: string; passed: string; total: string };
  err: {
    loadItems: string;
    loadPrivacy: string;
    savePrivacy: string;
    pickOneItem: string;
    scanHttp: string;
    missingRunId: string;
    scanFailed: string;
    loginForItems: string;
    loginForScan: string;
    loginForHistory: string;
    loginForRunDetail: string;
  };
  phase: { creating: string; taskCreated: string };
  autoContext: {
    banner: string;
    client: string;
    cloudBase: string;
    routeMode: string;
    localStats: string;
    loginEmail: string;
    notLoggedIn: string;
    unknownSystem: string;
    cloudUnset: string;
    unknownRoute: string;
    userExtra: string;
  };
  sections: {
    SANDBOX_POLICY: string;
    AI_RUNTIME: string;
    AI_VULNERABILITY: string;
    OTHER: string;
  };
  groups: {
    NETWORK_ACCESS: string;
    FILE_SECURITY: string;
    SYSTEM_PROTECTION: string;
    PRIVACY: string;
    PROMPT_SECURITY: string;
    SKILLS_SECURITY: string;
    SCRIPT_EXECUTION: string;
    VULNERABILITY_SCAN: string;
    FIREWALL_BASELINE: string;
    _OTHER: string;
  };
  items: {
    privacyTitle: string;
    shareHistoryTitle: string;
    shareHistoryDesc: string;
    systemScanTitle: string;
    systemScanDesc: string;
    contextTitle: string;
    contextOptional: string;
    contextPlaceholder: string;
    rulesTitle: string;
    rulesDesc: string;
    selectAll: string;
    selectNone: string;
    syncingRules: string;
    loadingRules: string;
    rulesCount: string;
    badgeStatic: string;
    badgeAi: string;
    osWindows: string;
    osWindowsTitle: string;
    osMac: string;
    osMacTitle: string;
    osScopeTitle: string;
  };
  results: {
    emptyTitle: string;
    emptyDesc: string;
    scanning: string;
    title: string;
    summaryCritical: string;
    summaryWarn: string;
    summaryPass: string;
    summaryTotal: string;
    filterAll: string;
    filterCritical: string;
    filterWarn: string;
    filterPass: string;
    filterEmpty: string;
    location: string;
    remediation: string;
    severityCritical: string;
    severityWarn: string;
    severityPass: string;
  };
  history: {
    title: string;
    refresh: string;
    refreshing: string;
    empty: string;
    progressLabel: string;
    findingsLabel: string;
    open: string;
    opened: string;
  };
  runModal: {
    titlePrefix: string;
    subtitleLoading: string;
    applyToReport: string;
    refresh: string;
    closeAria: string;
    invalidRunId: string;
    loadFailedHttp: string;
    loadFailedNetwork: string;
    createdAt: string;
    updatedAt: string;
    pathLocation: string;
    remediationStrong: string;
    noData: string;
  };
}

/** 登录 / 注册页 */
export interface AuthPageMessages {
  login: {
    title: string;
    subtitle: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    submit: string;
    submitting: string;
    noAccount: string;
    goRegister: string;
    errBadJson: string;
    errFailed: string;
    successWithName: string;
  };
  register: {
    title: string;
    subtitle: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    nicknamePlaceholder: string;
    submit: string;
    submitting: string;
    hasAccount: string;
    goLogin: string;
    errPasswordMin: string;
    errBadJson: string;
    errEmailTaken: string;
    errFailed: string;
    successWithName: string;
  };
}

/** 拦截监控页（侧栏仍用 menu.interceptLogs） */
export interface InterceptMonitorPageMessages {
  title: string;
  intro: string;
  tabs: {
    overview: string;
    alerts: string;
    rules: string;
    requests: string;
    budget: string;
  };
  blockTypes: {
    danger_command: string;
    skill_disabled: string;
    budget_exceeded: string;
  };
  alerts: {
    typeLabel: string;
    filterAll: string;
    refresh: string;
    refreshing: string;
    loadFailed: string;
    loadDetailFailed: string;
    colTypeRisk: string;
    colReasons: string;
    colTime: string;
    tableLoading: string;
    tableEmpty: string;
    detail: string;
    prevPage: string;
    nextPage: string;
    pageInfo: string;
    modalTitle: string;
    close: string;
    labelTime: string;
    labelReasons: string;
    loading: string;
    fullContent: string;
    copy: string;
  };
  realtime: {
    loadFailed: string;
    labelTodayTokens: string;
    labelTodayCost: string;
    labelRequestCount: string;
    labelAvgLatency: string;
  };
  proxyRequests: {
    syncCloud: string;
    syncing: string;
    refresh: string;
    loading: string;
    loadFailed: string;
    syncFailed: string;
    syncResult: string;
    colTime: string;
    colProvider: string;
    colModel: string;
    colRoute: string;
    colStatus: string;
    colAlertType: string;
    colLatency: string;
    colCost: string;
    colTokens: string;
    tableEmpty: string;
    pageInfo: string;
    prevPage: string;
    nextPage: string;
  };
  budget: {
    errLoadSummary: string;
    errLoadSettings: string;
    errLoad: string;
    errSave: string;
    saveOk: string;
    errDelete: string;
    confirmDelete: string;
    title: string;
    subtitleBeforeOpenai: string;
    subtitleAfterOpenai: string;
    subtitleAfterStar: string;
    refresh: string;
    refreshing: string;
    statToday: string;
    statWeek: string;
    statMonth: string;
    tokensStat: string;
    requestsStat: string;
    progressSection: string;
    progressEmpty: string;
    disabledBadge: string;
    budgetDay: string;
    budgetWeek: string;
    budgetMonth: string;
    rulesSection: string;
    addRule: string;
    colProvider: string;
    colModel: string;
    colPriceInOut: string;
    colBudgetCaps: string;
    colState: string;
    colActions: string;
    emptyRules: string;
    stateOn: string;
    stateOff: string;
    edit: string;
    recentCalls: string;
    colRequestTime: string;
    colTotalTokens: string;
    colEstimatedCost: string;
    colCloudId: string;
    emptyEvents: string;
  };
  budgetModal: {
    titleCreate: string;
    titleEdit: string;
    sectionIdentity: string;
    labelProvider: string;
    phProvider: string;
    labelModel: string;
    phModel: string;
    sectionPricing: string;
    labelInputPrice: string;
    labelOutputPrice: string;
    sectionBudget: string;
    labelDayCap: string;
    labelWeekCap: string;
    labelMonthCap: string;
    phUnlimited: string;
    enableRule: string;
    cancel: string;
    save: string;
    saving: string;
    selectCollapse: string;
    selectExpand: string;
    selectNoMatch: string;
  };
  interceptRules: {
    titleEmbedded: string;
    titleStandalone: string;
    descEmbedded: string;
    descStandalone: string;
    syncRunning: string;
    syncManual: string;
    syncProgressRunning: string;
    syncProgressDone: string;
    loading: string;
    errLoadLocal: string;
    errSystemDisabled: string;
    errUpdateUser: string;
    toastEnabled: string;
    toastDisabled: string;
    errSyncHttp: string;
    errTriggerSync: string;
    keywordPh: string;
    filterSystemAll: string;
    filterCategoryAll: string;
    filterRiskAll: string;
    filterOfficialAll: string;
    filterOfficialOn: string;
    filterOfficialOff: string;
    filterUserAll: string;
    filterUserOn: string;
    filterUserOff: string;
    queryRunning: string;
    query: string;
    colId: string;
    colPattern: string;
    colSystem: string;
    colCategory: string;
    colRisk: string;
    colOfficial: string;
    colUserEnabled: string;
    officialNormal: string;
    officialDisabled: string;
    systemDisabledHint: string;
    emptyLocal: string;
    accountSwitching: string;
  };
}

/** 安全市场页（菜单 skills） */
export interface SkillsMarketPageMessages {
  title: string;
  intro: string;
  syncRunning: string;
  syncManual: string;
  clearLocal: string;
  tabs: { featured: string; safe: string; hot: string; new: string };
  featuredFallbackHint: string;
  syncProgressRunning: string;
  syncProgressDone: string;
  loading: string;
  errLoadLocal: string;
  errTriggerSync: string;
  errUpdateUser: string;
  toastSkillOn: string;
  toastSkillOff: string;
  errSafetyLabel: string;
  toastMarkedSafe: string;
  toastMarkedUnsafe: string;
  detailNeedLogin: string;
  detailCloudSearchFailed: string;
  detailNotFound: string;
  detailLoadFailed: string;
  errClearLocal: string;
  accountSwitching: string;
  keywordPh: string;
  filterSystemAll: string;
  sysNormal: string;
  sysDisabled: string;
  sysDeprecated: string;
  filterUserAll: string;
  userOn: string;
  userOff: string;
  queryRunning: string;
  query: string;
  colName: string;
  colProvider: string;
  colGrade: string;
  colStatus: string;
  colDesc: string;
  colEnable: string;
  safePrefix: string;
  unsafePrefix: string;
  downloadsPrefix: string;
  downloadsTitle: string;
  favoritesPrefix: string;
  favoritesTitle: string;
  starRatingTitle: string;
  verifiedPublisher: string;
  systemStatusDisabled: string;
  systemStatusDeprecated: string;
  systemStatusNormal: string;
  notConfigured: string;
  toggleEnabledTitle: string;
  toggleDisabledTitle: string;
  comingSoonTitle: string;
  auditReport: string;
  installTitleSysDisabled: string;
  installTitleAlreadyOn: string;
  installTitleEnable: string;
  safeInstall: string;
  alreadyEnabledBtn: string;
  detailBtn: string;
  emptyNoSkills: string;
  emptyNoMatch: string;
  pageSummary: string;
  pageFirst: string;
  pagePrev: string;
  pageNext: string;
  pageLast: string;
  modalTitle: string;
  modalClose: string;
  modalLoading: string;
  modalLabelName: string;
  modalLabelSlug: string;
  modalLabelType: string;
  modalLabelCategory: string;
  modalLabelStatus: string;
  modalLabelSource: string;
  modalLabelVersion: string;
  modalLabelShortDesc: string;
  modalLabelLongDesc: string;
  modalLabelTags: string;
  modalLabelInstallHint: string;
  modalLabelHomepage: string;
}

/** 文案结构（中英共用类型） */
export interface Messages {
  menu: {
    overview: string;
    securityScan: string;
    interceptLogs: string;
    openclaw: string;
    skills: string;
    agentMgmt: string;
  };
  header: {
    tagline: string;
    notLoggedIn: string;
    accountPlaceholderTitle: string;
    connection: {
      connected: string;
      connecting: string;
      error: string;
    };
    theme: {
      switchToDark: string;
      switchToLight: string;
      ariaToggle: string;
    };
    settings: {
      title: string;
      aria: string;
    };
    login: {
      label: string;
      title: string;
    };
    register: {
      label: string;
      title: string;
    };
    logout: {
      label: string;
      title: string;
    };
    lang: {
      pickerAria: string;
      pickerTitle: string;
    };
  };
  logoutModal: {
    title: string;
    body: string;
    cancel: string;
    confirm: string;
    confirming: string;
  };
  settingsPage: SettingsPageMessages;
  securityScanPage: SecurityScanPageMessages;
  authPage: AuthPageMessages;
  interceptMonitorPage: InterceptMonitorPageMessages;
  skillsMarketPage: SkillsMarketPageMessages;
}

/** 简体中文（默认） */
export const zh: Messages = {
  menu: {
    overview: "总览",
    securityScan: "安全扫描",
    interceptLogs: "拦截监控",
    openclaw: "OpenClaw",
    skills: "安全市场",
    agentMgmt: "Agent 管理",
  },
  header: {
    tagline: "Desktop · Agent Security",
    notLoggedIn: "未登录",
    accountPlaceholderTitle: "未登录",
    connection: {
      connected: "已连接服务器",
      connecting: "正在连接服务器…",
      error: "服务器连接异常",
    },
    theme: {
      switchToDark: "切换到暗黑主题",
      switchToLight: "切换到明亮主题",
      ariaToggle: "切换主题",
    },
    settings: {
      title: "设置",
      aria: "设置",
    },
    login: {
      label: "登录",
      title: "登录云端账户",
    },
    register: {
      label: "注册",
      title: "注册云端账户",
    },
    logout: {
      label: "退出",
      title: "退出登录",
    },
    lang: {
      pickerAria: "选择界面语言",
      pickerTitle: "语言",
    },
  },
  logoutModal: {
    title: "退出登录？",
    body: "确定要退出当前云端账号吗？本地设置不会清除。",
    cancel: "取消",
    confirm: "确定退出",
    confirming: "退出中…",
  },
  settingsPage: {
    intro:
      "在这里选择本地客户端调用 LLM 时的路由模式，并配置自定义转发映射。使用说明请切换到「文档与使用说明」。",
    tabs: { general: "常规设置", docs: "文档与使用说明" },
    llm: {
      sectionTitle: "LLM 路由模式",
      sectionDesc:
        "你可以选择直接连接上游 LLM，或通过 ClawHeart 云端网关转发（带危险指令监管与意图识别能力）。",
      gatewayTitle: "通过 ClawHeart 网关（推荐）",
      gatewayDesc:
        "请求先发到云端网关，由网关执行危险指令拦截与意图识别，再转发到上游 LLM。便于统一审计与策略配置。",
      directTitle: "直接连接 LLM（仅本地校验）",
      directDesc:
        "本地客户端直接调用上游 LLM，仅使用本地危险指令库做拦截。适合内网环境或对延迟更敏感的场景。",
      badgeCurrent: "当前",
    },
    loadingConfig: "正在加载当前配置…",
    state: { on: "已开启", off: "已关闭" },
    skills: {
      title: "Skills 用户设置同步",
      desc: "当你在本地客户端修改 Skill 的启用状态时，是否同步到云端。开启后，你的偏好设置将在多设备间保持一致。",
      detailOn: "修改 Skill 启用状态时会同步到云端",
      detailOff: "修改 Skill 启用状态时仅保存在本地",
    },
    dangers: {
      title: "危险指令用户设置同步",
      desc: "当你在本地客户端修改危险指令的启用状态时，是否同步到云端。开启后，你的偏好设置将在多设备间保持一致。",
      detailOn: "修改危险指令启用状态时会同步到云端",
      detailOff: "修改危险指令启用状态时仅保存在本地",
    },
    mappingSync: {
      title: "映射配置云端同步",
      desc: "开启后，添加/删除映射时会自动同步到云端。GATEWAY 模式需要云端映射才能正常工作。",
      detailOn: "映射会同步到云端（推荐）",
      detailOff: "映射仅保存在本地",
      pull: "从云端拉取映射",
      pulling: "同步中…",
      pullHint: "将云端映射配置同步到本地（会覆盖本地同名映射）",
    },
    networkMap: {
      title: "网络映射配置",
      body:
        "配置自定义前缀，将 http://127.0.0.1:19111/<前缀>/… 转发到任意上游网络基地址（不限于纯文本 LLM，亦可对接多模态等 HTTP API）。\n• DIRECT 模式：本地直接转发到目标基地址\n• GATEWAY 模式：转发到云端，云端查映射表并执行监管（需开启云端同步）",
    },
    mappingForm: {
      phPrefix: "前缀，例如 deepseek",
      phTarget: "目标基地址，例如 https://api.openai.com",
      addOrUpdate: "新增 / 更新",
    },
    mappingTable: {
      loading: "正在加载映射配置…",
      empty: "暂无映射配置。",
      colPrefix: "前缀",
      colTarget: "目标基地址",
      colGw: "本地网关地址（可复制）",
      gwHint: "可作为第三方应用的 Base URL",
      delete: "删除",
    },
    advanced: {
      title: "高级系统设置",
      desc: "用于本地联调/测试。开启后，云端 API Base 将切换为 http://localhost:8080。",
      testTitle: "测试模式（本地后端 8080）",
      currentApi: "当前：",
      toggleOn: "已开启：使用 http://localhost:8080",
      toggleOff: "已关闭：使用 https://api.clawheart.live",
    },
    account: {
      title: "账户与登录",
      hint: "在下方退出当前云端账号。本机设置与已同步规则会保留，需使用云端功能时请重新登录。",
    },
    err: {
      loadRoute: "加载路由模式失败",
      toggleTest: "切换测试模式失败",
      save: "保存失败",
      prefixTarget: "请填写前缀与目标地址",
      saveMapping: "保存映射失败",
      delMapping: "删除映射失败",
      syncToggle: "更新同步开关失败",
      loginFirst: "请先登录",
      cloudFetch: "获取云端映射失败",
      cloudNotJson: "云端返回格式错误（非 JSON），请检查后端配置",
      cloudBadShape: "云端映射数据格式错误（不是数组）",
    },
    toast: {
      testOn: "已开启测试模式（使用本地后端 8080）。",
      testOff: "已关闭测试模式（使用线上后端）。",
      routeOk: "已更新 LLM 路由模式。",
      mapLocalCloudFail: "已保存到本地，但云端同步失败（请检查登录状态）。",
      mapCloudOk: "已更新映射配置并同步到云端。",
      mapLocalOk: "已更新映射配置（仅本地）。",
      mapDeleted: "已删除一条映射。",
      skillsOn: "已开启 Skills 用户设置云端同步。",
      skillsOff: "已关闭 Skills 用户设置云端同步。",
      dangersOn: "已开启危险指令用户设置云端同步。",
      dangersOff: "已关闭危险指令用户设置云端同步。",
      mapSyncOn: "已开启映射同步到云端。",
      mapSyncOff: "已关闭映射同步到云端。",
      syncedFromCloud: "已从云端同步 {count} 条映射配置。",
    },
  },
  securityScanPage: {
    title: "安全与合规扫描",
    introP1: "从云端拉取通用扫描项，结合本机环境与你的说明，由 AI（云端 DeepSeek）与静态规则生成检测报告。",
    introP2BeforeCode: "需在系统配置中填写 ",
    introP2AfterCode: " 以启用完整 AI 能力。",
    refreshConfig: "刷新配置",
    runDeepScan: "执行深度扫描",
    scanning: "正在扫描...",
    scanDisabledNoItems: "暂无可用扫描项",
    tabs: { items: "配置与扫描项", results: "扫描结果报告", history: "扫描历史" },
    scanStatusRunning: "正在执行深度扫描",
    scanStatusReady: "扫描就绪",
    scanHintSelectItems: "请在下方选择扫描项后点击「执行深度扫描」。",
    stats: { critical: "严重", warning: "警告", passed: "通过", total: "合计" },
    err: {
      loadItems: "加载扫描项失败",
      loadPrivacy: "加载隐私配置失败",
      savePrivacy: "保存隐私配置失败",
      pickOneItem: "请至少选择一个扫描项",
      scanHttp: "扫描失败（{status}）",
      missingRunId: "扫描任务创建失败（缺少 runId）",
      scanFailed: "扫描失败",
      loginForItems: "请先登录云端账户后再获取安全扫描项。",
      loginForScan: "请先登录云端账户后再执行安全扫描。",
      loginForHistory: "请先登录云端账户后再查看扫描历史。",
      loginForRunDetail: "请先登录云端账户后再查看扫描记录。",
    },
    phase: { creating: "正在创建扫描任务…", taskCreated: "任务已创建，等待执行…" },
    autoContext: {
      banner: "【ClawHeart Desktop 自动上下文】",
      client: "- 客户端系统: {platformLabel}（platform={platform}）",
      cloudBase: "- 云端基地址: {value}",
      routeMode: "- 路由模式: {value}",
      localStats: "- 本地统计参考: 危险指令 {danger}，禁用技能 {disabled}，废弃技能 {deprecated}",
      loginEmail: "- 登录邮箱: {value}",
      notLoggedIn: "未登录",
      unknownSystem: "（未知）",
      cloudUnset: "（未配置）",
      unknownRoute: "（未知）",
      userExtra: "【用户补充说明】",
    },
    sections: {
      SANDBOX_POLICY: "沙箱安全策略",
      AI_RUNTIME: "AI 实时运行保护",
      AI_VULNERABILITY: "AI 漏洞防护",
      OTHER: "其他",
    },
    groups: {
      NETWORK_ACCESS: "网络访问保护",
      FILE_SECURITY: "文件安全保护",
      SYSTEM_PROTECTION: "系统安全保护",
      PRIVACY: "个人隐私保护",
      PROMPT_SECURITY: "Prompt 安全防护",
      SKILLS_SECURITY: "Skills 安全防护",
      SCRIPT_EXECUTION: "执行脚本检测",
      VULNERABILITY_SCAN: "漏洞检测",
      FIREWALL_BASELINE: "防火墙与通道基线",
      _OTHER: "其他",
    },
    items: {
      privacyTitle: "隐私与数据授权",
      shareHistoryTitle: "共享对话历史",
      shareHistoryDesc: "允许提取历史记录用于深度安全分析",
      systemScanTitle: "系统配置扫描",
      systemScanDesc: "同意读取本机 Agent 核心配置参数",
      contextTitle: "环境补充声明",
      contextOptional: "(可选)",
      contextPlaceholder:
        "在此输入您的特定环境说明，例如：使用的 MCP 列表、特定的 Provider 配置、敏感文件存放路径等。AI 将结合此上下文更精准地执行拦截…",
      rulesTitle: "检测规则集",
      rulesDesc:
        "勾选需在本地代理层生效的策略。下列按「大区 → 子模块」分组，宽屏下同一子模块内可多列排布。",
      selectAll: "全选",
      selectNone: "全不选",
      syncingRules: "正在从云端同步最新规则，当前操作不受影响...",
      loadingRules: "获取云端安全规则中...",
      rulesCount: "{count} 条规则",
      badgeStatic: "静态",
      badgeAi: "AI",
      osWindows: "仅 Windows",
      osWindowsTitle: "此扫描项仅在 Windows 客户端显示与执行",
      osMac: "仅 macOS",
      osMacTitle: "此扫描项仅在 macOS 客户端显示与执行",
      osScopeTitle: "客户端系统适用范围",
    },
    results: {
      emptyTitle: "环境安全，暂无发现项",
      emptyDesc: "当前未检测到安全风险。可在「配置与扫描项」发起扫描，或在「扫描历史」查看过往记录。",
      scanning: "正在执行安全扫描，请稍候…",
      title: "扫描结果",
      summaryCritical: "严重",
      summaryWarn: "警告",
      summaryPass: "通过",
      summaryTotal: "共 {count} 条",
      filterAll: "全部",
      filterCritical: "严重",
      filterWarn: "警告",
      filterPass: "通过",
      filterEmpty: "当前筛选下没有匹配项，请切换上方标签或选择「全部」。",
      location: "位置",
      remediation: "修复建议",
      severityCritical: "严重",
      severityWarn: "警告",
      severityPass: "通过",
    },
    history: {
      title: "历史扫描任务",
      refresh: "刷新历史",
      refreshing: "刷新中...",
      empty: "暂无历史扫描记录",
      progressLabel: "进度 {done}/{total}",
      findingsLabel: "发现 {count} 项风险",
      open: "查看详情",
      opened: "已打开",
    },
    runModal: {
      titlePrefix: "扫描记录 #",
      subtitleLoading: "加载中…",
      applyToReport: "应用到当前报告",
      refresh: "刷新",
      closeAria: "关闭",
      invalidRunId: "无效的 runId",
      loadFailedHttp: "加载失败（{status}）",
      loadFailedNetwork: "加载失败（网络错误）",
      createdAt: "创建时间：",
      updatedAt: "更新时间：",
      pathLocation: "路径/位置:",
      remediationStrong: "修复建议:",
      noData: "暂无数据",
    },
  },
  authPage: {
    login: {
      title: "登录云端账户",
      subtitle: "使用与网页端相同的账号。Token 保存在本机，用于同步规则与偏好设置。",
      emailPlaceholder: "邮箱地址",
      passwordPlaceholder: "密码",
      submit: "登录",
      submitting: "登录中…",
      noAccount: "没有账号？",
      goRegister: "注册",
      errBadJson: "登录响应不是合法 JSON",
      errFailed: "登录失败",
      successWithName: "登录成功：{name}",
    },
    register: {
      title: "注册云端账户",
      subtitle: "与网页端使用同一套接口。注册成功后自动登录并同步规则。",
      emailPlaceholder: "邮箱地址",
      passwordPlaceholder: "密码（至少 6 位）",
      nicknamePlaceholder: "昵称（选填）",
      submit: "注册并登录",
      submitting: "注册中…",
      hasAccount: "已有账号？",
      goLogin: "去登录",
      errPasswordMin: "密码至少 6 位",
      errBadJson: "注册响应不是合法 JSON",
      errEmailTaken: "注册失败，该邮箱可能已被使用",
      errFailed: "注册失败",
      successWithName: "注册成功：{name}",
    },
  },
  interceptMonitorPage: {
    title: "拦截监控",
    intro:
      "查看云端记录的拦截事件，并在此管理「拦截项目」——即参与本地匹配的危险指令规则库（原独立「危险指令库」已并入本页）。",
    tabs: {
      overview: "实时概览",
      alerts: "告警记录",
      rules: "拦截项目",
      requests: "请求日志",
      budget: "预算设置",
    },
    blockTypes: {
      danger_command: "危险指令",
      skill_disabled: "技能禁用",
      budget_exceeded: "预算拦截",
    },
    alerts: {
      typeLabel: "类型",
      filterAll: "全部",
      refresh: "刷新",
      refreshing: "加载中…",
      loadFailed: "加载失败",
      loadDetailFailed: "加载详情失败",
      colTypeRisk: "类型 / 风险",
      colReasons: "触发原因",
      colTime: "时间",
      tableLoading: "正在加载…",
      tableEmpty: "暂无拦截记录。",
      detail: "详情",
      prevPage: "上一页",
      nextPage: "下一页",
      pageInfo: "第 {page} / {totalPages} 页（共 {total} 条）",
      modalTitle: "拦截详情",
      close: "关闭",
      labelTime: "时间",
      labelReasons: "触发原因",
      loading: "加载中…",
      fullContent: "完整内容",
      copy: "复制",
    },
    realtime: {
      loadFailed: "加载实时概览失败",
      labelTodayTokens: "今日 Token",
      labelTodayCost: "今日费用",
      labelRequestCount: "请求次数",
      labelAvgLatency: "平均延时",
    },
    proxyRequests: {
      syncCloud: "与云端同步",
      syncing: "同步中…",
      refresh: "刷新",
      loading: "加载中…",
      loadFailed: "加载请求日志失败",
      syncFailed: "同步失败",
      syncResult: "已同步：上送 {pushed} 条（回写云端 ID {idMaps} 条），下行入库 {pulled} 条。",
      colTime: "时间",
      colProvider: "Provider",
      colModel: "Model",
      colRoute: "路由",
      colStatus: "状态",
      colAlertType: "告警类型",
      colLatency: "延时",
      colCost: "费用",
      colTokens: "Tokens",
      tableEmpty: "暂无请求日志",
      pageInfo: "第 {page} / {totalPages} 页（共 {total} 条）",
      prevPage: "上一页",
      nextPage: "下一页",
    },
    budget: {
      errLoadSummary: "加载汇总失败",
      errLoadSettings: "加载设置失败",
      errLoad: "加载失败",
      errSave: "保存失败",
      saveOk: "已保存。相同 Provider + Model 会合并为一条。",
      errDelete: "删除失败",
      confirmDelete: "确定删除该条费率/预算规则？",
      title: "API 预算与消耗控制台",
      subtitleBeforeOpenai: "按路径前缀识别 Provider（如 ",
      subtitleAfterOpenai: " 为 openai）；无前缀记为 default。Model 填 ",
      subtitleAfterStar: " 表示通用规则。",
      refresh: "刷新数据",
      refreshing: "刷新中…",
      statToday: "今日消耗",
      statWeek: "本周消耗",
      statMonth: "本月消耗",
      tokensStat: "Tokens",
      requestsStat: "请求",
      progressSection: "各模型预算进度",
      progressEmpty: "暂无已启用的预算规则，请在下方添加。",
      disabledBadge: "已禁用",
      budgetDay: "日度预算",
      budgetWeek: "周度预算",
      budgetMonth: "月度预算",
      rulesSection: "费率与预算规则",
      addRule: "新增规则",
      colProvider: "Provider",
      colModel: "Model",
      colPriceInOut: "单价 ($/1K) 入 / 出",
      colBudgetCaps: "预算上限 日 / 周 / 月",
      colState: "状态",
      colActions: "操作",
      emptyRules: "暂无配置规则",
      stateOn: "已启用",
      stateOff: "未启用",
      edit: "编辑",
      recentCalls: "最近调用流水 (Top 40)",
      colRequestTime: "请求时间",
      colTotalTokens: "总 Tokens",
      colEstimatedCost: "预估费用",
      colCloudId: "云端ID",
      emptyEvents: "暂无成功响应的本地流水记录",
    },
    budgetModal: {
      titleCreate: "新增费率与预算规则",
      titleEdit: "编辑规则",
      sectionIdentity: "基础识别",
      labelProvider: "Provider 提供商",
      phProvider: "例如: openai, anthropic",
      labelModel: "Model ID (* 为该 Provider 通配)",
      phModel: "例如: gpt-4o, claude-3",
      sectionPricing: "费率单价",
      labelInputPrice: "输入计费 ($ / 1K Tokens)",
      labelOutputPrice: "输出计费 ($ / 1K Tokens)",
      sectionBudget: "预算上限控制 (可选)",
      labelDayCap: "日上限 ($)",
      labelWeekCap: "周上限 ($)",
      labelMonthCap: "月上限 ($)",
      phUnlimited: "不限制则留空",
      enableRule: "启用此规则",
      cancel: "取消",
      save: "确认保存",
      saving: "保存中…",
      selectCollapse: "收起",
      selectExpand: "展开",
      selectNoMatch: "暂无匹配项",
    },
    interceptRules: {
      titleEmbedded: "拦截项目",
      titleStandalone: "危险指令库",
      descEmbedded:
        "以下为参与本地拦截匹配的「危险指令」规则：从云端同步至本地，可配置用户级启用/禁用。",
      descStandalone: "从云端增量同步至本地 SQLite，每批次 10 条。",
      syncRunning: "同步中…",
      syncManual: "手动同步",
      syncProgressRunning: "同步中：{synced}/{total} 条",
      syncProgressDone: "已同步：{synced} 条（总计：{total}）",
      loading: "加载中…",
      errLoadLocal: "加载本地数据失败",
      errSystemDisabled: "系统已禁用此危险指令，无法修改用户启用状态",
      errUpdateUser: "更新用户危险指令失败",
      toastEnabled: "已启用该危险指令。",
      toastDisabled: "已禁用该危险指令。",
      errSyncHttp: "无法开始同步（HTTP {status}）",
      errTriggerSync: "触发同步失败",
      keywordPh: "关键词（规则片段）",
      filterSystemAll: "系统类型（全部）",
      filterCategoryAll: "分类（全部）",
      filterRiskAll: "风险等级（全部）",
      filterOfficialAll: "官方状态（全部）",
      filterOfficialOn: "正常",
      filterOfficialOff: "禁用",
      filterUserAll: "用户启用（全部）",
      filterUserOn: "启用",
      filterUserOff: "禁用",
      queryRunning: "查询中…",
      query: "查询",
      colId: "ID",
      colPattern: "规则片段",
      colSystem: "系统",
      colCategory: "分类",
      colRisk: "风险等级",
      colOfficial: "官方状态",
      colUserEnabled: "用户启用",
      officialNormal: "正常",
      officialDisabled: "禁用",
      systemDisabledHint: "（系统禁用）",
      emptyLocal: "当前本地还没有同步到危险指令规则。",
      accountSwitching: "正在切换账号并同步用户偏好，请稍候…",
    },
  },
  skillsMarketPage: {
    title: "安全市场",
    intro: "按「官方精选 / 安全推荐 / 热门 / 最新」浏览技能；启用状态与云端同步策略不变。",
    syncRunning: "同步中…",
    syncManual: "手动同步",
    clearLocal: "清空本地数据",
    tabs: {
      featured: "官方精选",
      safe: "安全推荐",
      hot: "热门",
      new: "最新",
    },
    featuredFallbackHint:
      "云端尚未标记「官方精选」项，当前列表为状态「正常」的全部技能；标记同步后将仅显示精选。",
    syncProgressRunning: "同步中：{synced}/{total} 条",
    syncProgressDone: "已同步：{synced} 条（总计：{total}）",
    loading: "加载中…",
    errLoadLocal: "加载本地数据失败",
    errTriggerSync: "触发同步失败",
    errUpdateUser: "更新用户技能失败",
    toastSkillOn: "已启用该技能。",
    toastSkillOff: "已禁用该技能。",
    errSafetyLabel: "更新技能打标失败",
    toastMarkedSafe: "已标记为安全",
    toastMarkedUnsafe: "已标记为不安全",
    detailNeedLogin: "请先登录（缺少本地 token）",
    detailCloudSearchFailed: "云端查询详情失败",
    detailNotFound: "云端未找到该 skill（可能尚未同步或 slug 不匹配）",
    detailLoadFailed: "加载详情失败",
    errClearLocal: "清空本地数据失败",
    accountSwitching: "正在切换账号并同步用户偏好，请稍候…",
    keywordPh: "关键词（名称 / slug）",
    filterSystemAll: "系统状态（全部）",
    sysNormal: "正常",
    sysDisabled: "系统禁用",
    sysDeprecated: "系统不推荐",
    filterUserAll: "用户启用（全部）",
    userOn: "启用",
    userOff: "禁用",
    queryRunning: "查询中…",
    query: "查询",
    colName: "名称",
    colProvider: "提供商",
    colGrade: "等级",
    colStatus: "状态",
    colDesc: "简介",
    colEnable: "启用",
    safePrefix: "安全",
    unsafePrefix: "不安全",
    downloadsPrefix: "下载",
    downloadsTitle: "累计下载/安装量",
    favoritesPrefix: "收藏",
    favoritesTitle: "收藏 / 关注量",
    starRatingTitle: "星级评分",
    verifiedPublisher: "✓ 已验证发布者",
    systemStatusDisabled: "系统禁用",
    systemStatusDeprecated: "系统不推荐",
    systemStatusNormal: "正常",
    notConfigured: "（未配置）",
    toggleEnabledTitle: "已启用",
    toggleDisabledTitle: "未启用",
    comingSoonTitle: "即将推出",
    auditReport: "审计报告",
    installTitleSysDisabled: "系统未启用该技能",
    installTitleAlreadyOn: "已启用",
    installTitleEnable: "启用该技能",
    safeInstall: "安全安装",
    alreadyEnabledBtn: "已启用",
    detailBtn: "详情",
    emptyNoSkills: "当前本地还没有任何技能数据，请先登录并同步。",
    emptyNoMatch: "当前分类下没有符合条件的技能，可切换上方分类或调整筛选条件。",
    pageSummary: "共 {total} 条，第 {page} / {pages} 页（每页 {size} 条）",
    pageFirst: "首页",
    pagePrev: "上一页",
    pageNext: "下一页",
    pageLast: "末页",
    modalTitle: "技能详情",
    modalClose: "关闭",
    modalLoading: "加载详情中…",
    modalLabelName: "名称",
    modalLabelSlug: "Slug",
    modalLabelType: "类型",
    modalLabelCategory: "分类",
    modalLabelStatus: "状态",
    modalLabelSource: "来源",
    modalLabelVersion: "版本",
    modalLabelShortDesc: "简介",
    modalLabelLongDesc: "详细说明",
    modalLabelTags: "标签",
    modalLabelInstallHint: "安装提示",
    modalLabelHomepage: "主页",
  },
};
