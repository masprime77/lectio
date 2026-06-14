// First-run tutorial copy, adapted from the desktop renderer's TUTORIAL_STEPS
// (packages/desktop/app.js) and reworded for mobile navigation — there are no
// DOM selectors to spotlight, so each step is a self-contained card describing
// where to tap. Keep copy concise; add a step here when a feature ships.
export interface TutorialStep {
  id: string;
  title: string;
  description: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Lectio',
    description:
      'Lectio helps you plan your university semester: courses, weekly readings, and tasks — all in one place. This quick tour shows you around. Tap Next to begin.',
  },
  {
    id: 'semesters',
    title: 'Your semesters',
    description:
      'The first screen lists your semesters. Tap the "+" button to create one — give it a name, a start date, and a number of weeks, then add your courses.',
  },
  {
    id: 'courses',
    title: 'Courses & progress',
    description:
      'Open a semester to see its courses, each with a progress bar showing how many readings and tasks are done. Tap a course to view its readings and tasks.',
  },
  {
    id: 'tags',
    title: 'Reading & task tags',
    description:
      'Tap any reading or task to open its tag picker and choose a tag. Tags in the "done" group count toward progress. You can add, rename, recolor, and reorder your own tags from the "+" sheet.',
  },
  {
    id: 'study-mode',
    title: 'Study Mode',
    description:
      'The cap button on the courses screen toggles Study Mode, which recalculates progress counting only items tagged "Studied" — handy during revision week.',
  },
  {
    id: 'sort',
    title: 'Sort courses',
    description:
      'Use the Sort action in the header to reorder courses by progress, alphabetically, or by week — display only, your saved order is never changed.',
  },
  {
    id: 'breakdown',
    title: 'Breakdown',
    description:
      'Turn on Breakdown in the courses header to split each course into separate Readings and Tasks mini-bars, so you can see where the work is.',
  },
  {
    id: 'settings',
    title: 'Settings',
    description:
      'The gear in the top-left opens Settings: your account, sending feedback, and replaying this tour any time.',
  },
  {
    id: 'done',
    title: "You're all set",
    description:
      "That's the tour. You can replay it any time from Settings → Start tutorial. Good luck with your semester!",
  },
];
