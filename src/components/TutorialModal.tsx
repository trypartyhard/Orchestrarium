import { useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Bot,
  Sparkles,
  Terminal,
  Plus,
  Check,
  ToggleRight,
  Trash2,
  Save,
  Upload,
} from "lucide-react";

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
          agents, skills, and commands. It lets you browse, organize, and
          toggle them on or off without editing files manually.
        </p>
        <div className="rounded-lg border border-[#4fc3f7]/20 bg-[#4fc3f7]/5 px-4 py-3">
          <p className="text-[13px] text-[#4fc3f7]">
            <span className="font-semibold">How it works:</span> Claude Code
            stores agents, skills, and commands as{" "}
            <Kbd>.md</Kbd> files. Disabling an item moves it
            into a <Kbd>.disabled</Kbd> subfolder. Enabling it moves it back.
            Orchestrarium does this for you with a single click.
          </p>
        </div>
        <p className="text-[13px] leading-relaxed text-[#b0b0b8]">
          The app has <span className="font-semibold text-[#e8e8ec]">four sections</span>,
          accessible from the sidebar on the left:
        </p>
        <div className="grid grid-cols-2 gap-2">
          <IconBox icon={LayoutDashboard} color="#4fc3f7" label="Setup" />
          <IconBox icon={Bot} color="#4fc3f7" label="Agents" />
          <IconBox icon={Sparkles} color="#66bb6a" label="Skills" />
          <IconBox icon={Terminal} color="#ffa726" label="Commands" />
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
            <span className="text-[#56565f]">(global or project)</span>, and a
            button to add it to your Setup.
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
      </div>
    ),
  },
  {
    title: "Setup — Your Control Center",
    content: (
      <div className="flex flex-col gap-5">
        <p className="text-[13px] leading-relaxed text-[#b0b0b8]">
          The{" "}
          <span className="font-semibold text-[#e8e8ec]">
            <LayoutDashboard className="mb-0.5 inline h-3.5 w-3.5 text-[#4fc3f7]" />{" "}
            Setup
          </span>{" "}
          page is the heart of Orchestrarium. It shows all items you've added
          and lets you control them.
        </p>
        <div className="flex flex-col gap-3">
          <StepRow
            step={1}
            text={
              <>
                <span className="font-semibold text-[#e8e8ec]">
                  Summary cards
                </span>{" "}
                at the top show how many agents, skills, and commands are
                currently active vs. total.
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
                enable or disable items. This moves the <Kbd>.md</Kbd> file on
                disk in real time — Claude Code picks up changes instantly.
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
                let you enable/disable all items in a group at once.
              </>
            }
          />
          <StepRow
            step={4}
            text={
              <>
                The{" "}
                <Trash2 className="mb-0.5 inline h-3.5 w-3.5 text-[#56565f]" />{" "}
                button removes an item from your Setup (and disables it if it
                was on).
              </>
            }
          />
        </div>
      </div>
    ),
  },
  {
    title: "Saving & Loading Setups",
    content: (
      <div className="flex flex-col gap-5">
        <p className="text-[13px] leading-relaxed text-[#b0b0b8]">
          You can save your current configuration to a file and load it later.
          This is useful for switching between different workflows.
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-lg border border-[#3a3a42] bg-[#1e1e23] px-4 py-3">
            <span className="flex items-center gap-1.5 rounded-lg border border-[#4fc3f7]/30 bg-[#4fc3f7]/10 px-3 py-1.5 text-xs font-medium text-[#4fc3f7]">
              <Save className="h-3.5 w-3.5" />
              Save Setup
            </span>
            <span className="text-[13px] text-[#8a8a96]">
              — Exports your current setup to a <Kbd>.json</Kbd> file
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-[#3a3a42] bg-[#1e1e23] px-4 py-3">
            <span className="flex items-center gap-1.5 rounded-lg border border-[#4fc3f7]/30 bg-[#4fc3f7]/10 px-3 py-1.5 text-xs font-medium text-[#4fc3f7]">
              <Upload className="h-3.5 w-3.5" />
              Load Setup
            </span>
            <span className="text-[13px] text-[#8a8a96]">
              — Imports a setup file and applies it
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-[#ffa726]/20 bg-[#ffa726]/5 px-4 py-3">
          <p className="text-[13px] text-[#ffa726]">
            <span className="font-semibold">Tip:</span> Share setup files with
            your team so everyone uses the same agent configuration.
          </p>
        </div>
      </div>
    ),
  },
  {
    title: "Typical Workflow",
    content: (
      <div className="flex flex-col gap-5">
        <p className="text-[13px] leading-relaxed text-[#b0b0b8]">
          Here's how most users work with Orchestrarium:
        </p>
        <div className="flex flex-col gap-3">
          <StepRow
            step={1}
            text={
              <>
                Open the{" "}
                <span className="font-semibold text-[#4fc3f7]">Agents</span>,{" "}
                <span className="font-semibold text-[#66bb6a]">Skills</span>,
                or{" "}
                <span className="font-semibold text-[#ffa726]">Commands</span>{" "}
                tab to browse what's available.
              </>
            }
          />
          <StepRow
            step={2}
            text={
              <>
                Click{" "}
                <span className="font-semibold text-[#4fc3f7]">
                  Add to Setup
                </span>{" "}
                on items you want to use.
              </>
            }
          />
          <StepRow
            step={3}
            text={
              <>
                Switch to the{" "}
                <span className="font-semibold text-[#e8e8ec]">Setup</span>{" "}
                tab. Use the toggles to enable or disable items as needed.
              </>
            }
          />
          <StepRow
            step={4}
            text={
              <>
                Claude Code detects changes automatically — no restart
                required.
              </>
            }
          />
          <StepRow
            step={5}
            text={
              <>
                Optionally{" "}
                <span className="font-semibold text-[#e8e8ec]">
                  Save Setup
                </span>{" "}
                to keep your configuration for later.
              </>
            }
          />
        </div>
        <div className="rounded-lg border border-[#66bb6a]/20 bg-[#66bb6a]/5 px-4 py-3">
          <p className="text-[13px] text-[#66bb6a]">
            <span className="font-semibold">Pro tip:</span> Orchestrarium
            watches the filesystem in real time. If you add or remove{" "}
            <Kbd>.md</Kbd> files manually, the UI updates automatically.
          </p>
        </div>
      </div>
    ),
  },
];

export function TutorialModal({ onClose }: TutorialModalProps) {
  const [currentPage, setCurrentPage] = useState(0);
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
