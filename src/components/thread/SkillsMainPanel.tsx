import { useEffect, useMemo, useState } from "react";
import { Puzzle, Loader2, AlertCircle, Server, Plus, RefreshCw } from "lucide-react";
import { useSkillsStore } from "../../stores/skillsStore";
import { SkillGridCard } from "./SkillGridCard";
import { McpServerCard } from "./McpServerCard";
import { AddMcpServerDialog } from "./AddMcpServerDialog";
import { handleWindowDragStart } from "../../lib/windowDrag";
import claudeIcon from "../../assets/claude-ai-icon.svg";
import chatgptIcon from "../../assets/chatgpt-icon.svg";
import { useT } from "../../i18n";

export function SkillsMainPanel() {
  const t = useT();
  const skills = useSkillsStore((s) => s.skills);
  const loading = useSkillsStore((s) => s.loading);
  const error = useSkillsStore((s) => s.error);
  const installing = useSkillsStore((s) => s.installing);
  const searchQuery = useSkillsStore((s) => s.searchQuery);
  const activeCategory = useSkillsStore((s) => s.activeCategory);
  const fetchSkills = useSkillsStore((s) => s.fetchSkills);
  const installSkill = useSkillsStore((s) => s.installSkill);
  const uninstallSkill = useSkillsStore((s) => s.uninstallSkill);

  const mcpServers = useSkillsStore((s) => s.mcpServers);
  const mcpLoading = useSkillsStore((s) => s.mcpLoading);
  const mcpRemoving = useSkillsStore((s) => s.mcpRemoving);
  const fetchMcpServers = useSkillsStore((s) => s.fetchMcpServers);
  const removeMcpServer = useSkillsStore((s) => s.removeMcpServer);

  const [showAddMcp, setShowAddMcp] = useState(false);

  useEffect(() => {
    if (skills.length === 0) fetchSkills();
    if (mcpServers.length === 0) fetchMcpServers();
  }, [fetchSkills, fetchMcpServers, skills.length, mcpServers.length]);

  const filtered = useMemo(() => {
    let result = skills;

    // Category filter
    if (activeCategory === "installed") {
      result = result.filter((s) => s.installed);
    } else if (activeCategory !== "all" && activeCategory !== "mcp") {
      result = result.filter((s) => s.category === activeCategory);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          (s.category?.toLowerCase().includes(q) ?? false),
      );
    }

    return result;
  }, [skills, activeCategory, searchQuery]);

  const filteredMcp = useMemo(() => {
    let servers = mcpServers;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      servers = servers.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.transport.toLowerCase().includes(q) ||
          (m.command?.toLowerCase().includes(q) ?? false) ||
          (m.url?.toLowerCase().includes(q) ?? false),
      );
    }
    return servers;
  }, [mcpServers, searchQuery]);

  const claudeMcpServers = useMemo(
    () => filteredMcp.filter((m) => m.scope !== "codex"),
    [filteredMcp],
  );
  const codexConfigServers = useMemo(
    () => filteredMcp.filter((m) => m.scope === "codex"),
    [filteredMcp],
  );

  const showPlugins = activeCategory !== "mcp";
  const showMcp = activeCategory === "all" || activeCategory === "mcp";

  if (loading && skills.length === 0 && !showMcp) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 panel-bg">
        <div data-tauri-drag-region className="absolute inset-x-0 top-0 h-7" onMouseDown={handleWindowDragStart} />
        <Loader2 size={24} className="animate-spin text-zinc-400" />
        <span className="text-sm text-zinc-400">{t("chat.skills.loading")}</span>
      </div>
    );
  }

  if (error && skills.length === 0 && !showMcp) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 panel-bg">
        <div data-tauri-drag-region className="absolute inset-x-0 top-0 h-7" onMouseDown={handleWindowDragStart} />
        <AlertCircle size={24} className="text-red-400/60" />
        <span className="text-sm text-zinc-400">{t("chat.skills.loadFailed")}</span>
        <button
          onClick={fetchSkills}
          className="rounded-md bg-zinc-800 px-4 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          {t("chat.skills.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col panel-bg">
      {/* Drag region */}
      <div data-tauri-drag-region className="h-7 shrink-0" onMouseDown={handleWindowDragStart} />

      {/* Header */}
      <div className="shrink-0 px-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 ring-1 ring-blue-500/20">
            <Puzzle size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">{t("chat.skills.title")}</h1>
            <p className="text-xs text-zinc-400">
              {t("chat.skills.description")}
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-8">
        {/* Plugins section */}
        {showPlugins && (
          <div>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                <Puzzle size={32} strokeWidth={1} className="mb-3 opacity-40" />
                <span className="text-sm">
                  {searchQuery.trim() ? t("chat.skills.noMatchingSkills") : t("chat.skills.noSkillsCategory")}
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((skill) => (
                  <SkillGridCard
                    key={`${skill.marketplace}-${skill.name}`}
                    skill={skill}
                    installing={installing[skill.name] ?? false}
                    onInstall={() => installSkill(skill.name, skill.marketplace)}
                    onUninstall={() => uninstallSkill(skill.name, skill.marketplace)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* MCP Servers section */}
        {showMcp && (
          <div>
            {/* Divider when showing both */}
            {activeCategory === "all" && filtered.length > 0 && (
              <div className="border-t border-white/[0.06] mb-6" />
            )}

            {/* Section header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server size={16} className="text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-200">{t("chat.skills.mcpServers")}</h2>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                  {filteredMcp.length}
                </span>
                {mcpLoading && (
                  <Loader2 size={12} className="animate-spin text-zinc-400" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchMcpServers}
                  disabled={mcpLoading || mcpLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-800/60 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-white/[0.1] hover:bg-zinc-700/60 hover:text-zinc-300"
                  title={t("chat.skills.refresh")}
                >
                  <RefreshCw size={12} className={mcpLoading ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={() => setShowAddMcp(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-white/[0.1] hover:bg-zinc-700/60 hover:text-zinc-100"
                >
                  <Plus size={12} />
                  {t("chat.skills.addServer")}
                </button>
              </div>
            </div>

            {/* Claude Code MCP Servers */}
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <img src={claudeIcon} alt="" className="h-4 w-4" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Claude Code</h3>
                <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                  {claudeMcpServers.length}
                </span>
              </div>
              {claudeMcpServers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                  <Server size={24} strokeWidth={1} className="mb-2 opacity-40" />
                  <span className="text-xs">
                    {searchQuery.trim() ? t("chat.skills.noMatchingServers") : t("chat.skills.noClaudeMcpServers")}
                  </span>
                  {!searchQuery.trim() && (
                    <button
                      onClick={() => setShowAddMcp(true)}
                      className="mt-2 rounded-lg bg-blue-600/20 px-3 py-1 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-600/30"
                    >
                      {t("chat.skills.addFirstServer")}
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {claudeMcpServers.map((server) => (
                    <McpServerCard
                      key={`${server.scope}-${server.project_path ?? "global"}-${server.name}`}
                      server={server}
                      removing={mcpRemoving[server.name] ?? false}
                      onRemove={() => removeMcpServer(server.name)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Codex MCP Servers */}
            <div>
              <div className="border-t border-white/[0.06] pt-6 mb-3 flex items-center gap-2">
                <img src={chatgptIcon} alt="" className="h-4 w-4" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Codex</h3>
                <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                  {codexConfigServers.length}
                </span>
              </div>
              {codexConfigServers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                  <Server size={24} strokeWidth={1} className="mb-2 opacity-40" />
                  <span className="text-xs">
                    {mcpLoading ? t("chat.skills.loading") : t("chat.skills.noCodexMcpServers")}
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {codexConfigServers.map((server) => (
                    <McpServerCard
                      key={`codex-${server.name}`}
                      server={server}
                      removing={mcpRemoving[server.name] ?? false}
                      onRemove={() => removeMcpServer(server.name)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AddMcpServerDialog open={showAddMcp} onClose={() => setShowAddMcp(false)} />
    </div>
  );
}
