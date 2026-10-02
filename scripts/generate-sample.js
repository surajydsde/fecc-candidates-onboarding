// Generates the sample candidate sheet: public/sample/fecc-candidates-sample.xlsx
// Run with: npm run sample
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const OUT = path.resolve('public/sample/fecc-candidates-sample.xlsx');

const COMMON = ['Information Security Awareness', 'Code of Conduct & Ethics', 'Data Privacy Fundamentals'];
const BY_DEPT = {
  Frontend: { role: 'Frontend Engineer', course: 'React Fundamentals' },
  Backend: { role: 'Backend Engineer', course: 'Node.js Fundamentals' },
  QA: { role: 'QA Engineer', course: 'Test Automation Basics' },
  DevOps: { role: 'DevOps Engineer', course: 'AWS Cloud Basics' },
  'UI/UX': { role: 'UI/UX Designer', course: 'Design Systems Basics' },
};

// [name, department, stage, coursesDoneCount (for courses-pending rows), remarks]
// stage: pre = pre-onboarding pending, post = post-onboarding pending,
//        courses = courses pending, released = all courses complete (release candidate)
const PEOPLE = [
  ['Aarav Sharma', 'Frontend', 'released', 4, 'Allocated to client project'],
  ['Priya Nair', 'Backend', 'courses', 2, 'Data Privacy due this week'],
  ['Rohan Mehta', 'QA', 'pre', 0, 'Documents awaited'],
  ['Sneha Kulkarni', 'Frontend', 'released', 4, ''],
  ['Vikram Singh', 'DevOps', 'post', 1, 'Laptop handover pending'],
  ['Ananya Iyer', 'UI/UX', 'courses', 3, ''],
  ['Karan Patel', 'Backend', 'released', 4, 'Ready for allocation'],
  ['Meera Joshi', 'Frontend', 'pre', 0, 'Background verification in progress'],
  ['Arjun Reddy', 'QA', 'courses', 1, ''],
  ['Divya Menon', 'Frontend', 'post', 2, 'Buddy not assigned yet'],
  ['Siddharth Rao', 'DevOps', 'released', 4, ''],
  ['Pooja Deshmukh', 'Backend', 'courses', 0, 'Joined late; courses not started'],
  ['Rahul Verma', 'Frontend', 'released', 4, 'Allocated to client project'],
  ['Neha Gupta', 'QA', 'post', 3, 'Access requests raised'],
  ['Aditya Kumar', 'UI/UX', 'pre', 0, 'Offer letter signed; joining kit pending'],
  ['Kavya Pillai', 'Frontend', 'courses', 2, ''],
  ['Manish Yadav', 'Backend', 'released', 4, ''],
  ['Ishita Banerjee', 'DevOps', 'courses', 3, 'AWS Cloud Basics in progress'],
  ['Nikhil Chavan', 'Frontend', 'post', 0, 'ID card pending'],
  ['Tanvi Shah', 'QA', 'released', 4, 'Ready for allocation'],
  ['Harsh Agarwal', 'Backend', 'pre', 0, 'Medical check pending'],
  ['Riya Kapoor', 'UI/UX', 'released', 4, ''],
  ['Omkar Patil', 'Frontend', 'courses', 1, ''],
  ['Shruti Mishra', 'DevOps', 'post', 2, 'Induction session rescheduled'],
  ['Yash Thakur', 'Frontend', 'pre', 0, 'Documents awaited'],
];

function joiningDate(i) {
  // Spread joining dates across Aug–Sep 2026 (UTC so the sheet shows the same date everywhere).
  return new Date(Date.UTC(2026, 7, 3 + ((i * 3) % 56)));
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'FECC Candidate Onboarding';
  wb.created = new Date(Date.UTC(2026, 9, 1));

  const ws = wb.addWorksheet('Candidates', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Candidate ID', key: 'id', width: 14 },
    { header: 'Candidate Name', key: 'name', width: 22 },
    { header: 'Email', key: 'email', width: 32 },
    { header: 'Department', key: 'dept', width: 13 },
    { header: 'Role', key: 'role', width: 20 },
    { header: 'Joining Date', key: 'doj', width: 14, style: { numFmt: 'dd-mmm-yyyy' } },
    { header: 'Pre-Onboarding Checklist', key: 'pre', width: 24 },
    { header: 'Post-Onboarding Checklist', key: 'post', width: 25 },
    { header: 'Required Courses', key: 'required', width: 70 },
    { header: 'Completed Courses', key: 'completed', width: 70 },
    { header: 'Release Status', key: 'release', width: 15 },
    { header: 'Remarks', key: 'remarks', width: 36 },
  ];

  PEOPLE.forEach(([name, dept, stage, done, remarks], i) => {
    const required = [...COMMON, BY_DEPT[dept].course];
    const doneCount = stage === 'released' ? required.length : stage === 'pre' ? 0 : done;
    const completed = required.slice(0, doneCount);
    const [first, last] = name.toLowerCase().split(' ');
    ws.addRow({
      id: `FECC-${String(1001 + i)}`,
      name,
      email: `${first}.${last}@example.com`,
      dept,
      role: BY_DEPT[dept].role,
      doj: joiningDate(i),
      pre: stage === 'pre' ? 'Pending' : 'Completed',
      post: stage === 'pre' || stage === 'post' ? 'Pending' : 'Completed',
      required: required.join('; '),
      completed: completed.join('; '),
      release: stage === 'released' ? 'Released' : 'Not Released',
      remarks,
    });
  });

  const header = ws.getRow(1);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    cell.alignment = { vertical: 'middle' };
  });
  ws.autoFilter = { from: 'A1', to: 'L1' };

  const last = PEOPLE.length + 1;
  const statusColors = { Completed: 'FFD1FAE5', Released: 'FFD1FAE5', Pending: 'FFFEF3C7', 'Not Released': 'FFF1F5F9' };
  for (let r = 2; r <= last; r++) {
    for (const col of ['G', 'H']) {
      ws.getCell(`${col}${r}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['"Completed,Pending"'] };
    }
    ws.getCell(`K${r}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['"Released,Not Released"'] };
    for (const col of ['G', 'H', 'K']) {
      const cell = ws.getCell(`${col}${r}`);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColors[cell.value] || 'FFFFFFFF' } };
    }
  }

  const guide = wb.addWorksheet('Instructions');
  guide.columns = [
    { header: 'Column', key: 'c', width: 28 },
    { header: 'Required?', key: 'r', width: 11 },
    { header: 'What to enter', key: 'w', width: 90 },
  ];
  [
    ['Candidate ID', 'Optional', 'Unique ID, e.g. FECC-1001. Auto-generated from the row number if left blank.'],
    ['Candidate Name', 'Yes', 'Full name.'],
    ['Email', 'Optional', 'Work or personal email.'],
    ['Department', 'Optional', 'e.g. Frontend, Backend, QA, DevOps, UI/UX.'],
    ['Role', 'Optional', 'Designation.'],
    ['Joining Date', 'Optional', 'A date cell, or text as YYYY-MM-DD or DD/MM/YYYY.'],
    ['Pre-Onboarding Checklist', 'Yes', 'Completed or Pending (Yes/No and Done also work).'],
    ['Post-Onboarding Checklist', 'Yes', 'Completed or Pending (Yes/No and Done also work).'],
    ['Required Courses', 'Recommended', 'Courses the candidate must finish, separated by semicolons.'],
    ['Completed Courses', 'Recommended', 'Courses finished so far, separated by semicolons. Names must match Required Courses.'],
    ['Release Status', 'Optional', 'Released or Not Released. Candidates who completed all required courses are counted as released.'],
    ['Remarks', 'Optional', 'Any notes.'],
    ['', '', ''],
    ['Note', '', 'The app reads the sheet named "Candidates" (or the first sheet with data). Accepted files: .xlsx or .csv, up to 3 MB.'],
  ].forEach((row) => guide.addRow(row));
  guide.getRow(1).font = { bold: true };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);
  console.log(`Wrote ${OUT} (${PEOPLE.length} candidates)`);
}

main();
