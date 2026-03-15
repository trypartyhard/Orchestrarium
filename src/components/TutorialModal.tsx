import { useState, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Bot,
  Sparkles,
  Terminal,
  Library,
  Plus,
  Check,
  ToggleRight,
  Trash2,
  Save,
  Play,
  Pause,
  Download,
  Upload,
  FileText,
  Plug,
  Settings,
  XCircle,
  Pencil,
  Eye,
  Search,
  Info,
  Globe,
  FolderOpen,
  RefreshCw,
  Copy,
} from "lucide-react";
import { useEscapeKey } from "../lib/useEscapeKey";

interface TutorialModalProps {
  onClose: () => void;
}

interface Page {
  title: string;
  content: React.ReactNode;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-[#3a3a42] bg-[#1e1e23] px-1.5 py-0.5 text-[11px] font-medium text-[#8a8a96]">
      {children}
    </kbd>
  );
}

function IconBox({
  icon: Icon,
  color,
  label,
}: {
  icon: typeof Bot;
  color: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-[#3a3a42] bg-[#1e1e23] px-3 py-2">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: color + "18" }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </span>
      <span className="text-sm text-[#c0c0c8]">{label}</span>
    </div>
  );
}

function StepRow({
  step,
  text,
}: {
  step: number;
  text: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4fc3f7]/15 text-xs font-bold text-[#4fc3f7]">
        {step}
      </span>
      <p className="text-[13px] leading-relaxed text-[#b0b0b8]">{text}</p>
    </div>
  );
}

const pages: Page[] = [
  {
    title: "Welcome to Orchestrarium",
    content: (
      <div className="flex flex-col gap-5">
        <p className="text-[13px] leading-relaxed text-[#b0b0b8]">
          <span className="font-semibold text-[#e8e8ec]">Orchestrarium</span>{" "}
          is a visual manager for{" "}
          <span className="font-semibold text-[#e8e8ec]">Claude Code</span>{" "}
          agents, skills, commands, and MCP configurations. It lets you
          browse, organize, and switch them without editing files manually.
        </p>
        <div className="rounded-lg border border-[#4fc3f7]/20 bg-[#4fc3f7]/5 px-4 py-3">
          <p className="text-[13px] text-[#4fc3f7]">
            <span className="font-semibold">How it works:</span> Claude Code
            stores agents, skills, and commands as <Kbd>.md</Kbd> files, while
            MCP servers live in Claude config files. Orchestrarium updates both
            safely for you with a single click.
          </p>
        </div>
        <p className="text-[13px] leading-relaxed text-[#b0b0b8]">
          Orchestrarium supports both{" "}
          <span className="font-semibold text-[#4fc3f7]">global</span>{" "}
          <span className="text-[#56565f]">(~/.claude)</span> and{" "}
          <span className="font-semibold text-[#ffa726]">project-level</span>{" "}
          <span className="text-[#56565f]">(.claude/)</span> configurations.
          Switch between them using the context switcher at the top of the sidebar.
        </p>
        <p className="text-[13px] leading-relaxed text-[#b0b0b8]">
          The app has <span className="font-semibold text-[#e8e8ec]">seven sections</span>,
          accessible from the sidebar:
        </p>
        <div className="grid grid-cols-2 gap-2">
          <IconBox icon={LayoutDashboard} color="#4fc3f7" label="Setup" />
          <IconBox icon={Bot} color="#4fc3f7" label="Agents" />
          <IconBox icon={Sparkles} color="#66bb6a" label="Skills" />
          <IconBox icon={Terminal} color="#ffa726" label="Commands" />
          <IconBox icon={Library} color="#a78bfa" label="Library" />
          <IconBox icon={FileText} color="#a78bfa" label="CLAUDE.md" />
          <IconBox icon={Plug} color="#4fc3f7" label="MCP Servers" />
        </div>
        <p className="text-[12px] text-[#56565f]">
          Let's go through each one.
        </p>
      </div>
    ),
  },
  {
    title: "Agents, Skills & Commands",
    content: (
      <div className="flex flex-col gap-5">
        <p className="text-[13px] leading-relaxed text-[#b0b0b8]">
          These three sections share the same layout. Each one lists all
          items of that type found on your system.
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-[#4fc3f7]" />
              <span className="text-sm font-semibold text-[#e8e8ec]">
                Agents
              </span>
            </div>
            <p className="ml-6 text-[13px] text-[#8a8a96]">
              Autonomous helpers that Claude Code can delegate tasks to. They
              run in the background and perform specialized work (e.g.,
              code review, testing, research).
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#66bb6a]" />
              <span className="text-sm font-semibold text-[#e8e8ec]">
                Skills
              </span>
            </div>
            <p className="ml-6 text-[13px] text-[#8a8a96]">
              Reusable prompt templates that you can invoke with{" "}
              <Kbd>/skill-name</Kbd> in Claude Code. They define specific
              behaviors or workflows (e.g., <Kbd>/commit</Kbd>,{" "}
              <Kbd>/lint-fix</Kbd>).
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[#ffa726]" />
              <span className="text-sm font-semibold text-[#e8e8ec]">
                Commands
              </span>
            </div>
            <p className="ml-6 text-[13px] text-[#8a8a96]">
              Custom slash commands registered in Claude Code. Similar to
              skills but often simpler and more targeted.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-[#3a3a42] bg-[#1e1e23] px-4 py-3">
          <p className="text-[13px] text-[#b0b0b8]">
            Each card shows the item's{" "}
            <span className="text-[#e8e8ec]">name</span>,{" "}
            <span className="text-[#e8e8ec]">description</span>,{" "}
            <span className="text-[#e8e8ec]">scope</span>{" "}
            <span className="text-[#56565f]">(global or project)</span>, a{" "}
            <Eye className="mb-0.5 inline h-3 w-3 text-[#4fc3f7]" />{" "}
            <span className="text-[#e8e8ec]">preview</span> button to view
            the full file content, and a button to add it to your Setup.
          </p>
        </div>
      </div>
    ),
  },
  {
    title: "Adding Items to Setup",
    content: (
      <div className="flex flex-col gap-5">
        <p className="text-[13px] leading-relaxed text-[#b0b0b8]">
          In the Agents, Skills, or Commands section, each item has an action
          button on the right:
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-lg border border-[#3a3a42] bg-[#1e1e23] px-4 py-3">
            <span className="flex items-center gap-1.5 rounded-lg border border-[#4fc3f7]/30 bg-[#4fc3f7]/10 px-3 py-1.5 text-xs font-medium text-[#4fc3f7]">
              <Plus className="h-3 w-3" />
              Add to Setup
            </span>
            <span className="text-[13px] text-[#8a8a96]">
              — Click to include this item in your Setup
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-[#3a3a42] bg-[#1e1e23] px-4 py-3">
            <span className="flex items-center gap-1.5 rounded-lg border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-3 py-1.5 text-xs font-medium text-[#00d4aa]">
              <Check className="h-3 w-3" />
              In Setup
            </span>
            <span className="text-[13px] text-[#8a8a96]">
              — Already in your Setup
            </span>
          </div>
        </div>
        <p className="text-[13px] leading-relaxed text-[#b0b0b8]">
          You can also use the{" "}
          <span className="font-semibold text-[#e8e8ec]">search bar</span> to
          find items by name and the{" "}
          <span className="font-semibold text-[#e8e8ec]">filter pills</span>{" "}
          to show only enabled, disabled, or all items.
        </p>
        <div className="rounded-lg border border-[#3a3a42] bg-[#1e1e23] px-4 py-3">
          <p className="text-[13px] text-[#b0b0b8]">
            <Info className="mb-0.5 inline h-3 w-3 text-[#4fc3f7]" />{" "}
            When adding an item that belongs to a{" "}
            <span className="font-semibold text-[#e8e8ec]">group</span>,
            you'll be asked whether to add just that item or the entire group.
          </p>
        </div>
      </div>
    ),
  },
  {
    title: "Setup - Your Active Workspace",
    content: (
      <div className="flex flex-col gap-5">
        <p className="text-[13px] leading-relaxed text-[#b0b0b8]">
          The{" "}
          <span className="font-semibold text-[#e8e8ec]">
            <LayoutDashboard className="mb-0.5 inline h-3.5 w-3.5 text-[#4fc3f7]" />{" "}
            Setup
          </span>{" "}
          page is your active workspace for agents, skills, and commands. It
          shows the items you've added and lets you enable, disable, and
          organize them in one place.
        </p>
        <div className="rounded-lg border border-[#4fc3f7]/20 bg-[#4fc3f7]/5 px-4 py-3">
          <p className="text-[13px] text-[#4fc3f7]">
            <span className="font-semibold">First launch:</span> Orchestrarium
            automatically detects the agents, skills, and commands that are
            already active on your system and adds them to Setup. You start
            from your current working configuration instead of an empty list.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-[#3a3a42] bg-[#1e1e23] px-4 py-3">
            <p className="text-[13px] text-[#b0b0b8]">
              <span className="font-semibold text-[#c0c0c8]">Scope note:</span>{" "}
              Setup manages the <Kbd>.md</Kbd>-based layer only.{" "}
              <span className="font-semibold text-[#e8e8ec]">CLAUDE.md</span>{" "}
              profiles and{" "}
              <span className="font-semibold text-[#e8e8ec]">MCP Servers</span>{" "}
              have their own sections.
            </p>
          </div>
          <div className="rounded-lg border border-[#66bb6a]/20 bg-[#66bb6a]/5 px-4 py-3">
            <p className="text-[13px] text-[#66bb6a]">
              <span className="font-semibold">Tip:</span> On first launch,
              consider saving your current setup to the Library so you always
              have a clean restore point.
            </p>
          </div>
          <StepRow
            step={1}
            text={
              <>
                <span className="font-semibold text-[#e8e8ec]">
                  Summary cards
                </span>{" "}
                at the top show counts for the items in your current Setup.
                Click a card to filter the list by category, then click again
                to clear the filter.
              </>
            }
          />
          <StepRow
            step={2}
            text={
              <>
                <span className="font-semibold text-[#e8e8ec]">
                  Toggle switches{" "}
                  <ToggleRight className="mb-0.5 inline h-4 w-4 text-[#4fc3f7]" />
                </span>{" "}
                enable or disable individual items. Orchestrarium moves the
                corresponding <Kbd>.md</Kbd> file on disk immediately, and
                Claude Code picks up the change automatically.
              </>
            }
          />
          <StepRow
            step={3}
            text={
              <>
                <span className="font-semibold text-[#e8e8ec]">
                  Group toggles
                </span>{" "}
                let you enable or disable all items in a group at once.
              </>
            }
          />
          <StepRow
            step={4}
            text={
              <>
                The{" "}
                <Trash2 className="mb-0.5 inline h-3.5 w-3.5 text-[#56565f]" />{" "}
                button removes an item from Setup. If it was enabled, it is
                disabled as part of that removal.
              </>
            }
          />
          <StepRow
            step={5}
            text={
              <>
                <span className="inline-flex items-center gap-1 font-semibold text-red-400">
                  <XCircle className="inline h-3 w-3" /> Clear Setup
                </span>{" "}
                removes all items from Setup and disables them. Saved entries
                in the Library are not affected.
              </>
            }
          />
          <StepRow
            step={6}
            text={
              <>
                <span className="inline-flex items-center gap-1 font-semibold text-[#4fc3f7]">
                  <RefreshCw className="inline h-3 w-3" /> Update
                </span>{" "}
                appears when you change an active saved setup by toggling,
                adding, or removing items. Click it to write those changes back
                to the Library entry.
              </>
            }
          />
        </div>
        <div className="rounded-lg border border-[#3a3a42] bg-[#1e1e23] px-4 py-3">
          <p className="text-[13px] text-[#b0b0b8]">
            <span className="font-semibold text-[#c0c0c8]">Active setup:</span>{" "}
            When you activate a setup from the Library, its name appears under
            the header. Any later changes are tracked, so you can use{" "}
            <span className="font-semibold text-[#e8e8ec]">Update</span> to
            save the edited version back to the same Library item.
          </p>
        </div>
        <div className="rounded-lg border border-[#ffa726]/20 bg-[#ffa726]/5 px-4 py-3">
          <p className="text-[13px] text-[#ffa726]">
            <span className="font-semibold">Group Warning:</span> When you
            disable an item that belongs to a named group, Orchestrarium will
            warn you that it may affect other items in that group. You can
            turn these warnings off in{" "}
            <Settings className="mb-0.5 inline h-3 w-3" /> Settings.
          </p>
        </div>
      </div>
    ),
  },
  {
    title: "Library — Saved Setups",
    content: (
      <div className="flex flex-col gap-5">
        <p className="text-[13px] leading-relaxed text-[#b0b0b8]">
          The{" "}
          <span className="font-semibold text-[#e8e8ec]">
            <Library className="mb-0.5 inline h-3.5 w-3.5 text-[#a78bfa]" />{" "}
            Library
          </span>{" "}
          stores all your saved setups. Switch between configurations instantly.
        </p>
        <div className="flex flex-col gap-3">
          <StepRow
            step={1}
            text={
              <>
                In the{" "}
                <span className="font-semibold text-[#e8e8ec]">Setup</span>{" "}
                tab, click{" "}
                <span className="inline-flex items-center gap-1 font-semibold text-[#4fc3f7]">
                  <Save className="inline h-3 w-3" /> Save Setup
                </span>{" "}
                — it saves directly to the Library.
              </>
            }
          />
          <StepRow
            step={2}
            text={
              <>
                Open the{" "}
                <span className="font-semibold text-[#a78bfa]">Library</span>{" "}
                tab to see all saved setups with their details.
              </>
            }
          />
          <StepRow
            step={3}
            text={
              <>
                Click{" "}
                <span className="inline-flex items-center gap-1 font-semibold text-[#4fc3f7]">
                  <Play className="inline h-3 w-3" /> Activate
                </span>{" "}
                to apply a setup. This is{" "}
                <span className="font-semibold text-[#e8e8ec]">exclusive</span>
                : it enables only items in that setup and disables everything
                else. The setup name appears in the Setup header.
              </>
            }
          />
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-[#3a3a42] bg-[#1e1e23] px-4 py-3">
          <p className="text-[12px] text-[#8a8a96]">
            <span className="font-semibold text-[#c0c0c8]">Library also supports:</span>
          </p>
          <div className="flex items-center gap-2 text-[12px] text-[#8a8a96]">
            <Download className="h-3 w-3 text-[#56565f]" /> Export — save setup as a <Kbd>.json</Kbd> file to share
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[#8a8a96]">
            <Upload className="h-3 w-3 text-[#56565f]" /> Import — load a setup from a <Kbd>.json</Kbd> file
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[#8a8a96]">
            <Trash2 className="h-3 w-3 text-[#56565f]" /> Delete — remove a setup from the Library
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[#8a8a96]">
            <Search className="h-3 w-3 text-[#56565f]" /> Search — quickly find a setup by name
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "CLAUDE.md Profiles",
    content: (
      <div className="flex flex-col gap-5">
        <p className="text-[13px] leading-relaxed text-[#b0b0b8]">
          <span className="font-semibold text-[#e8e8ec]">CLAUDE.md</span> is
          a configuration file that defines how Claude Code behaves — its
          rules, style, and instructions. Orchestrarium lets you manage
          multiple profiles and switch between them.
        </p>
        <div className="rounded-lg border border-[#4fc3f7]/20 bg-[#4fc3f7]/5 px-4 py-3">
          <p className="text-[13px] text-[#4fc3f7]">
            <span className="font-semibold">Auto-import:</span> If you already
            have a CLAUDE.md file, Orchestrarium automatically imports it as
            a "Default" profile on first launch.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <StepRow
            step={1}
            text={
              <>
                <span className="inline-flex items-center gap-1 font-semibold text-[#a78bfa]">
                  <Plus className="inline h-3 w-3" /> New Profile
                </span>{" "}
                — create a profile (empty or copied from your current CLAUDE.md).
              </>
            }
          />
          <StepRow
            step={2}
            text={
              <>
                <span className="inline-flex items-center gap-1 font-semibold text-[#a78bfa]">
                  <Play className="inline h-3 w-3" /> Activate
                </span>{" "}
                — writes the profile content into{" "}
                <Kbd>~/.claude/CLAUDE.md</Kbd>. Claude Code reads it immediately.
              </>
            }
          />
          <StepRow
            step={3}
            text={
              <>
                <span className="inline-flex items-center gap-1 font-semibold text-[#8a8a96]">
                  <Pause className="inline h-3 w-3" /> Deactivate
                </span>{" "}
                — clears CLAUDE.md contents. The profile stays saved for later.
              </>
            }
          />
          <StepRow
            step={4}
            text={
              <>
                <Eye className="mb-0.5 inline h-3.5 w-3.5 text-[#a78bfa]" />{" "}
                <span className="font-semibold text-[#8a8a96]">Preview</span>{" "}
                — view profile content without editing.
              </>
            }
          />
          <StepRow
            step={5}
            text={
              <>
                <span className="inline-flex items-center gap-1 font-semibold text-[#8a8a96]">
                  <Pencil className="inline h-3 w-3" /> Edit
                </span>{" "}
                — built-in editor to modify profile content directly in the app.
              </>
            }
          />
        </div>
        <div className="rounded-lg border border-[#3a3a42] bg-[#1e1e23] px-4 py-3">
          <p className="text-[13px] text-[#b0b0b8]">
            <span className="font-semibold text-[#c0c0c8]">Example profiles:</span>{" "}
            "Strict Review" for production code, "Fast Prototype" for
            hackathons, "Python Backend" for specific tech stacks.
          </p>
        </div>
      </div>
    ),
  },
  {
    title: "MCP Servers",
    content: (
      <div className="flex flex-col gap-5">
        <p className="text-[13px] leading-relaxed text-[#b0b0b8]">
          The <span className="font-semibold text-[#e8e8ec]">MCP Servers</span>{" "}
          section manages Model Context Protocol tools for Claude Code.
          Orchestrarium uses a profile-first flow, so you can switch between
          saved MCP bundles without hand-editing JSON.
        </p>
        <div className="rounded-lg border border-[#4fc3f7]/20 bg-[#4fc3f7]/5 px-4 py-3">
          <p className="text-[13px] text-[#4fc3f7]">
            <span className="font-semibold">Profiles is the default tab:</span>{" "}
            a profile is a saved bundle of one or more MCP servers, such as
            Brave Search, GitHub, and filesystem tools in one stack.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <StepRow
            step={1}
            text={(
              <>
                Click{" "}
                <span className="inline-flex items-center gap-1 font-semibold text-[#4fc3f7]">
                  <Plus className="inline h-3 w-3" /> New Profile
                </span>{" "}
                to create a bundle. Add more than one MCP by placing multiple
                entries inside the profile's <Kbd>servers</Kbd> object.
              </>
            )}
          />
          <StepRow
            step={2}
            text={(
              <>
                Use <span className="font-semibold text-[#e8e8ec]">Validate</span>{" "}
                to run a dry run before changing anything. It checks JSON shape,
                name collisions, and managed-state drift.
              </>
            )}
          />
          <StepRow
            step={3}
            text={(
              <>
                Click{" "}
                <span className="inline-flex items-center gap-1 font-semibold text-[#4fc3f7]">
                  <Play className="inline h-3 w-3" /> Activate
                </span>{" "}
                to write the active bundle into <Kbd>~/.claude.json</Kbd> in
                global context or <Kbd>.mcp.json</Kbd> in project context.
                Only one MCP profile is active per context.
              </>
            )}
          />
          <StepRow
            step={4}
            text={(
              <>
                <span className="inline-flex items-center gap-1 font-semibold text-[#8a8a96]">
                  <Pause className="inline h-3 w-3" /> Deactivate
                </span>{" "}
                removes only servers owned by that profile. Manual live servers
                stay untouched.
              </>
            )}
          />
          <StepRow
            step={5}
            text={(
              <>
                Open <span className="font-semibold text-[#e8e8ec]">Live Servers</span>{" "}
                to inspect the actual current config. In project context, this
                is also the advanced view for adding or editing local{" "}
                <Kbd>.mcp.json</Kbd> entries directly.
              </>
            )}
          />
        </div>
        <div className="rounded-lg border border-[#66bb6a]/20 bg-[#66bb6a]/5 px-4 py-3">
          <p className="text-[13px] text-[#66bb6a]">
            <span className="font-semibold">Important:</span> Claude Code reads
            the live MCP config, not the saved profile itself. Profiles are
            presets; Live Servers shows what is actually active right now.
          </p>
        </div>
      </div>
    ),
  },
  {
    title: "Project Context",
    content: (
      <div className="flex flex-col gap-5">
        <p className="text-[13px] leading-relaxed text-[#b0b0b8]">
          Orchestrarium works with two contexts — items can live in{" "}
          <span className="font-semibold text-[#4fc3f7]">global</span>{" "}
          <span className="text-[#56565f]">(~/.claude/)</span> or{" "}
          <span className="font-semibold text-[#ffa726]">project</span>{" "}
          <span className="text-[#56565f]">({"{project}"}/.claude/)</span>{" "}
          directories. Switch between them using the context toggle at the top of
          the sidebar.
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-lg border border-[#3a3a42] bg-[#1e1e23] px-4 py-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#4fc3f7]/15">
              <Globe className="h-3.5 w-3.5 text-[#4fc3f7]" />
            </span>
            <div>
              <span className="text-sm font-semibold text-[#e8e8ec]">Global</span>
              <p className="text-[12px] text-[#8a8a96]">
                Items in <Kbd>~/.claude/</Kbd> — available in every project
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-[#3a3a42] bg-[#1e1e23] px-4 py-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ffa726]/15">
              <FolderOpen className="h-3.5 w-3.5 text-[#ffa726]" />
            </span>
            <div>
              <span className="text-sm font-semibold text-[#e8e8ec]">Project</span>
              <p className="text-[12px] text-[#8a8a96]">
                Items in your project's <Kbd>.claude/</Kbd> folder — scoped to that project
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <StepRow
            step={1}
            text={
              <>
                Click the{" "}
                <FolderOpen className="mb-0.5 inline h-3.5 w-3.5 text-[#ffa726]" />{" "}
                button in the sidebar to select a project folder.
              </>
            }
          />
          <StepRow
            step={2}
            text={
              <>
                Items show a{" "}
                <span className="font-semibold text-[#e8e8ec]">scope badge</span>{" "}
                — <Kbd>global</Kbd> or <Kbd>project</Kbd> — so you always know
                where they live.
              </>
            }
          />
          <StepRow
            step={3}
            text={
              <>
                In project context, global items can be{" "}
                <span className="inline-flex items-center gap-1 font-semibold text-[#4fc3f7]">
                  <Copy className="inline h-3 w-3" /> copied to project
                </span>{" "}
                — a local copy is created in the project directory.
              </>
            }
          />
        </div>
        <div className="rounded-lg border border-[#66bb6a]/20 bg-[#66bb6a]/5 px-4 py-3">
          <p className="text-[13px] text-[#66bb6a]">
            <span className="font-semibold">Tip:</span> Each context has its own
            Setup and Library entries. Switching context instantly shows items
            from that directory.
          </p>
        </div>
      </div>
    ),
  },
  {
    title: "Typical Workflows",
    content: (
      <div className="flex flex-col gap-5">
        <p className="text-[13px] leading-relaxed text-[#b0b0b8]">
          Most users follow a few simple workflows in Orchestrarium: building a
          working Setup, saving reusable combinations in the Library, and
          switching CLAUDE.md or MCP configurations when a task needs different
          behavior or tools.
        </p>
        <div className="flex flex-col gap-3">
          <StepRow
            step={1}
            text={
              <>
                Start in{" "}
                <span className="font-semibold text-[#4fc3f7]">Agents</span>,{" "}
                <span className="font-semibold text-[#66bb6a]">Skills</span>,
                and{" "}
                <span className="font-semibold text-[#ffa726]">Commands</span>{" "}
                to browse what is available and add the items you want to your
                Setup.
              </>
            }
          />
          <StepRow
            step={2}
            text={
              <>
                Move to the{" "}
                <span className="font-semibold text-[#e8e8ec]">Setup</span>{" "}
                tab to enable, disable, and organize your current working set
                of md-based items.
              </>
            }
          />
          <StepRow
            step={3}
            text={
              <>
                When the combination feels right, use{" "}
                <span className="font-semibold text-[#e8e8ec]">
                  Save Setup
                </span>{" "}
                to keep it in the{" "}
                <span className="font-semibold text-[#a78bfa]">Library</span>{" "}
                for later reuse.
              </>
            }
          />
          <StepRow
            step={4}
            text={
              <>
                Use the{" "}
                <span className="font-semibold text-[#a78bfa]">Library</span>{" "}
                to switch between saved setups quickly when you move between
                different tasks or projects.
              </>
            }
          />
          <StepRow
            step={5}
            text={
              <>
                Open{" "}
                <span className="font-semibold text-[#e8e8ec]">CLAUDE.md</span>{" "}
                when you want Claude Code to follow a different instruction
                style, role, or project-specific rules.
              </>
            }
          />
          <StepRow
            step={6}
            text={
              <>
                Open{" "}
                <span className="font-semibold text-[#e8e8ec]">MCP Servers</span>{" "}
                when you need external tools such as search, docs, GitHub, or
                filesystem access. Validate the profile first, then activate the
                bundle in the current context.
              </>
            }
          />
        </div>
        <div className="rounded-lg border border-[#66bb6a]/20 bg-[#66bb6a]/5 px-4 py-3">
          <p className="text-[13px] text-[#66bb6a]">
            <span className="font-semibold">Pro tip:</span> You do not need to
            reconfigure everything every time. Keep reusable setups in the{" "}
            <span className="font-semibold text-[#e8e8ec]">Library</span>,
            reusable instruction presets in{" "}
            <span className="font-semibold text-[#e8e8ec]">CLAUDE.md</span>,
            and reusable tool bundles in{" "}
            <span className="font-semibold text-[#e8e8ec]">MCP Servers</span>.
          </p>
        </div>
        <div className="rounded-lg border border-[#3a3a42] bg-[#1e1e23] px-4 py-3">
          <p className="text-[13px] text-[#b0b0b8]">
            <Settings className="mb-0.5 inline h-3 w-3 text-[#56565f]" />{" "}
            <span className="font-semibold text-[#c0c0c8]">Settings</span>{" "}
            also lets experienced users hide group notifications for a less
            chatty workflow.
          </p>
        </div>
      </div>
    ),
  },
];

export function TutorialModal({ onClose }: TutorialModalProps) {
  const [currentPage, setCurrentPage] = useState(0);
  useEscapeKey(useCallback(onClose, [onClose]));
  const page = pages[currentPage];
  const isFirst = currentPage === 0;
  const isLast = currentPage === pages.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative flex h-[520px] w-[560px] flex-col rounded-xl border border-[#3a3a42] bg-[#1e1e23] shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#3a3a42] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#e8e8ec]">
            {page.title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close tutorial"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#6b6b78] transition-colors hover:bg-[#2a2a32] hover:text-[#c0c0c8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{page.content}</div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-[#3a3a42] px-6 py-4">
          {/* Dots */}
          <div className="flex gap-1.5">
            {pages.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                className={`h-2 rounded-full transition-all ${
                  i === currentPage
                    ? "w-5 bg-[#4fc3f7]"
                    : "w-2 bg-[#3a3a42] hover:bg-[#56565f]"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex gap-2">
            {!isFirst && (
              <button
                onClick={() => setCurrentPage((p) => p - 1)}
                className="flex h-8 items-center gap-1 rounded-lg border border-[#3a3a42] px-3 text-xs text-[#8a8a96] transition-colors hover:border-[#56565f] hover:text-[#c0c0c8]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={onClose}
                className="flex h-8 items-center gap-1 rounded-lg bg-[#4fc3f7] px-4 text-xs font-medium text-[#1e1e23] transition-colors hover:bg-[#4fc3f7]/80"
              >
                Get Started
              </button>
            ) : (
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                className="flex h-8 items-center gap-1 rounded-lg bg-[#4fc3f7] px-4 text-xs font-medium text-[#1e1e23] transition-colors hover:bg-[#4fc3f7]/80"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
