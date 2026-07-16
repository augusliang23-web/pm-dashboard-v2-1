export function completeProjectReportFixture() {
  return {
    week: { weekLabel: 'W28 2026', weekDate: 'Jul 6 - Jul 12' },
    sections: [
      'project-brief', 'project-update', 'milestone', 'gantt',
      'team-allocation', 'resources', 'budget'
    ],
    project: {
      name: 'Platform Modernization', code: 'PMS-001', projectLevel: 'system',
      status: 'red', progress: 62, attention: 'action',
      owner: 'Augus', deputy: 'Bonnie', customer: 'Operations', location: 'Singapore',
      highlight: 'Prototype approved\nPilot environment ready',
      risk: 'Vendor lead time',
      weeklyActions: 'Confirm alternate supplier\nComplete integration test',
      milestones: [
        { name: 'Design approval', date: '2026-07-04', status: 'done' },
        { name: 'Pilot build', date: '2026-07-18', status: 'in-progress' },
        { name: 'Launch readiness', date: '2026-08-14', status: 'at-risk' }
      ],
      quarterlyMilestones: [
        { quarter: 'Q3', name: 'Pilot complete', progress: 55, status: 'in-progress' }
      ],
      ganttWorkstreams: [
        { name: 'Design', startDate: '2026-06-20', endDate: '2026-07-08', status: 'completed', progress: 100 },
        { name: 'Integration', startDate: '2026-07-01', endDate: '2026-08-05', status: 'at-risk', progress: 48 }
      ],
      teamMembers: [
        { name: 'Bonnie', roleName: 'Firmware', effortPct: 70 },
        { name: 'Josiah', roleName: 'System Electrical', effortPct: 50 }
      ],
      resources: {
        role_firmware: { role: 'Firmware', estimated: 120, actual: 72 },
        role_system_electrical: { role: 'System Electrical', estimated: 90, actual: 40 }
      },
      budget: {
        currency: 'USD', totalEstimated: 120000,
        monthlyPlans: [{ month: '2026-07', categoryName: 'NRE', currency: 'USD', amount: 60000 }],
        actuals: [{ month: '2026-07', categoryName: 'NRE', currency: 'USD', amount: 42000 }]
      }
    }
  };
}

export function completeOverviewReportFixture() {
  const project = completeProjectReportFixture().project;
  const secondProject = {
    ...project,
    name: 'Module Refresh', code: 'MOD-002', projectLevel: 'hardware-module',
    status: 'yellow', progress: 78, attention: 'monitor', owner: 'Mia',
    risk: 'Validation capacity', weeklyActions: 'Reserve backup laboratory'
  };
  return {
    week: {
      weekLabel: 'W28 2026',
      weekDate: 'Jul 6 - Jul 12',
      executiveSummary: 'Pilot work is progressing with one supplier escalation.',
      projects: [project, secondProject]
    },
    trendWeeks: [
      { weekLabel: 'W27', projects: [{ ...project, status: 'yellow', progress: 55 }, { ...secondProject, progress: 70 }] },
      { weekLabel: 'W28', projects: [project, secondProject] }
    ],
    sections: [
      'health-focus', 'weekly-trend', 'executive-summary', 'attention-matrix',
      'risk-actions', 'quarterly-roadmap', 'project-portfolio',
      'resource-analytics', 'budget-overview'
    ],
    overviewScope: 'all'
  };
}

export function structuredExecutiveSummaryFixture() {
  return `WEEKLY MOVEMENT
Portfolio Summary: Portfolio delivery remained stable while validation and supplier recovery received focused management attention.

- Project: Platform Modernization
  Movement: Pilot validation advanced and the integration environment is ready.
  Blocker: Alternate supplier timing remains unconfirmed.
  Next step: Complete integration testing and confirm the recovery date.

- Project: Module Refresh
  Movement: The prototype build completed and entered functional verification.
  Blocker: Laboratory capacity is constrained this week.
  Next step: Reserve backup validation capacity.

- Project: Power Controller
  Movement: Main-board design review closed with follow-up actions agreed.
  Blocker: One long-lead component remains under commercial review.
  Next step: Confirm the procurement strategy.

- Project: Battery Gateway
  Movement: Firmware messaging and diagnostic flows passed internal review.
  Blocker: None
  Next step: Begin the customer simulation cycle.

- Project: Rack Prototype
  Movement: Two prototype units entered fabrication with shipment planning active.
  Blocker: Delivery dates remain provisional.
  Next step: Lock the customer delivery windows.

- Project: Edge Platform
  Movement: The validation and commercial workstreams were separated into clear gates.
  Blocker: External confirmation of the commercial timeline remains open.
  Next step: Confirm the gate owners and dates.

MANAGEMENT ASK

- Project: Module Refresh
  Decision / Support needed: Approve priority access to backup laboratory capacity.
  Business impact: Protects the verification and release schedule.

- Project: Platform Modernization
  Decision / Support needed: Support supplier escalation and recovery-date confirmation.
  Business impact: Reduces pilot integration uncertainty.

- Project: Power Controller
  Decision / Support needed: Confirm the long-lead procurement approach.
  Business impact: Limits EVT-to-PVT schedule exposure.

- Project: Edge Platform
  Decision / Support needed: Confirm ownership of the commercial validation gate.
  Business impact: Enables reliable customer commitment planning.`;
}
