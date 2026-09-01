"use client";

import Link from "next/link";
import type { Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/format";
import { getTasksReport } from "@/services/reports.service";
import type { TaskReportGroups, TaskReportRow, TaskReportSummary } from "@/types/reports";
import { ReportView, type ReportFilterField } from "./ReportView";
import { last30Days, priorityTone, taskStatusTone } from "./report-shared";

const columns: Column<TaskReportRow>[] = [
  { key: "task", header: "Task", render: (r) => <span className="font-medium text-umber">{r.title}</span> },
  {
    key: "case",
    header: "Case",
    render: (r) => (
      <Link href={`/cases/${r.caseId}`} className="text-brand-800 hover:underline">
        {r.caseNumber}
      </Link>
    ),
  },
  { key: "org", header: "Organization", render: (r) => r.organization ?? "—" },
  { key: "assignee", header: "Assignee", render: (r) => r.assignee ?? <span className="text-slate-400">Unassigned</span> },
  { key: "priority", header: "Priority", render: (r) => <StatusBadge label={r.priorityLabel} tone={priorityTone(r.priority)} /> },
  { key: "status", header: "Status", render: (r) => <StatusBadge label={r.statusLabel} tone={taskStatusTone(r.status)} /> },
  { key: "overdue", header: "Overdue", render: (r) => (r.overdue ? <span className="text-rose-600">Overdue</span> : <span className="text-slate-400">—</span>) },
  { key: "created", header: "Created", render: (r) => formatDate(r.createdAt) },
  { key: "due", header: "Due", render: (r) => formatDate(r.dueAt) },
  { key: "completed", header: "Completed", render: (r) => formatDate(r.completedAt) },
];

const filters: ReportFilterField[] = [
  {
    key: "status",
    label: "Status",
    kind: "select",
    options: [
      { value: "OPEN", label: "Open" },
      { value: "IN_PROGRESS", label: "In progress" },
      { value: "COMPLETED", label: "Completed" },
      { value: "CANCELLED", label: "Cancelled" },
    ],
  },
  {
    key: "priority",
    label: "Priority",
    kind: "select",
    options: [
      { value: "LOW", label: "Low" },
      { value: "NORMAL", label: "Normal" },
      { value: "HIGH", label: "High" },
      { value: "URGENT", label: "Urgent" },
    ],
  },
  { key: "overdue", label: "Overdue only", kind: "toggle" },
  { key: "search", label: "Search", kind: "text", placeholder: "Task title, case…" },
];

export function TasksReport() {
  return (
    <ReportView<TaskReportRow, TaskReportSummary, TaskReportGroups>
      reportType="tasks"
      title="Task Report"
      description="Case task counts and current statuses. Date range applies to task creation."
      scope={{ dateRange: true, organization: true, facility: true }}
      extraFilters={filters}
      defaults={last30Days()}
      fetcher={getTasksReport}
      columns={columns}
      getRowKey={(r) => r.id}
      summaryCards={(s) => [
        { label: "Open", value: s.open, tone: "info" },
        { label: "In progress", value: s.inProgress, tone: "info" },
        { label: "Completed", value: s.completed, tone: "positive" },
        { label: "Cancelled", value: s.cancelled, tone: "neutral" },
        { label: "Overdue", value: s.overdue, tone: "negative" },
        { label: "High / urgent active", value: s.highUrgentActive, tone: "warning" },
      ]}
      groupSections={(g) => [
        { title: "Tasks by Status", rows: g.byStatus },
        { title: "Tasks by Priority", rows: g.byPriority },
      ]}
      emptyMessage="No tasks match the current filters."
      loadingLabel="Loading tasks…"
    />
  );
}
