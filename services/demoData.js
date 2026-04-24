import AsyncStorage from '@react-native-async-storage/async-storage';

const TEACHER_ASSIGNMENTS_KEY = 'demo_teacher_assignments';

const DEMO_NADIA_STUDENTS = [
  { roll_number: 'NAD-001', full_name: 'Ayesha Khan', class_name: '8', section: 'A', email: 'ayesha.khan@student.local' },
  { roll_number: 'NAD-002', full_name: 'Bilal Ahmed', class_name: '8', section: 'A', email: 'bilal.ahmed@student.local' },
  { roll_number: 'NAD-003', full_name: 'Hira Noor', class_name: '8', section: 'B', email: 'hira.noor@student.local' },
];

const toStudentKey = (student) =>
  String(student?.id ?? student?.student_id ?? student?.roll_number ?? student?.email ?? student?.full_name ?? '');

const normalizeStudent = (student, fallbackTeacher) => ({
  id: student?.id ?? student?.student_id ?? toStudentKey(student),
  full_name: student?.full_name ?? student?.student_name ?? 'Student',
  roll_number: student?.roll_number ?? 'N/A',
  class_name: student?.class_name ?? '',
  section: student?.section ?? '',
  email: student?.email ?? '',
  teacher_id: student?.teacher_id ?? fallbackTeacher?.id ?? '',
  teacher_name: student?.teacher_name ?? fallbackTeacher?.full_name ?? '',
});

export async function getTeacherAssignments() {
  try {
    const raw = await AsyncStorage.getItem(TEACHER_ASSIGNMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveTeacherAssignments(assignments) {
  await AsyncStorage.setItem(TEACHER_ASSIGNMENTS_KEY, JSON.stringify(assignments));
}

export async function seedNadiaAssignments(teachers = [], students = []) {
  const nadia = teachers.find((teacher) => teacher?.full_name?.trim().toLowerCase() === 'nadia hussain');
  if (!nadia) return { students, assignments: await getTeacherAssignments() };

  const assignments = await getTeacherAssignments();
  const nadiaKey = String(nadia.id);
  const existing = Array.isArray(assignments[nadiaKey]) ? assignments[nadiaKey] : [];

  let seeded = existing;
  if (!seeded.length) {
    seeded = (students.length ? students.slice(0, 3) : DEMO_NADIA_STUDENTS).map((student, index) =>
      normalizeStudent(
        {
          ...student,
          id: student?.id ?? `nadia-demo-${index + 1}`,
          roll_number: student?.roll_number ?? DEMO_NADIA_STUDENTS[index]?.roll_number,
          class_name: student?.class_name ?? DEMO_NADIA_STUDENTS[index]?.class_name,
          section: student?.section ?? DEMO_NADIA_STUDENTS[index]?.section,
          email: student?.email ?? DEMO_NADIA_STUDENTS[index]?.email,
        },
        nadia
      )
    );
    assignments[nadiaKey] = seeded;
    await saveTeacherAssignments(assignments);
  }

  const seededMap = new Map(seeded.map((student) => [toStudentKey(student), student]));
  const mergedStudents = students.map((student) => {
    const match = seededMap.get(toStudentKey(student));
    if (!match) return student;
    return {
      ...student,
      teacher_id: student.teacher_id || nadia.id,
      teacher_name: student.teacher_name || nadia.full_name,
    };
  });

  return { students: mergedStudents, assignments };
}

export async function assignStudentToTeacher(student, teacher) {
  if (!teacher?.id) return;
  const assignments = await getTeacherAssignments();
  const teacherKey = String(teacher.id);
  const list = Array.isArray(assignments[teacherKey]) ? assignments[teacherKey] : [];
  const normalized = normalizeStudent(student, teacher);
  const next = [...list.filter((item) => toStudentKey(item) !== toStudentKey(normalized)), normalized];
  assignments[teacherKey] = next;
  await saveTeacherAssignments(assignments);
}

export async function removeStudentFromTeacher(student, teacherId) {
  if (!teacherId) return;
  const assignments = await getTeacherAssignments();
  const teacherKey = String(teacherId);
  const list = Array.isArray(assignments[teacherKey]) ? assignments[teacherKey] : [];
  assignments[teacherKey] = list.filter((item) => toStudentKey(item) !== toStudentKey(student));
  await saveTeacherAssignments(assignments);
}

export async function getAssignedStudentsForTeacher(teacher) {
  const teacherName = teacher?.full_name?.trim().toLowerCase() || teacher?.name?.trim().toLowerCase();
  if (!teacher?.id && !teacherName) return [];
  const assignments = await getTeacherAssignments();
  const list = assignments[String(teacher.id)];
  if (Array.isArray(list) && list.length) {
    return list.map((student) => normalizeStudent(student, teacher));
  }

  const matched = Object.values(assignments)
    .flat()
    .filter((student) => student?.teacher_name?.trim?.().toLowerCase?.() === teacherName);
  if (matched.length) {
    return matched.map((student) => normalizeStudent(student, teacher));
  }

  if (teacherName === 'nadia hussain') {
    return DEMO_NADIA_STUDENTS.map((student, index) =>
      normalizeStudent(
        {
          ...student,
          id: `nadia-demo-${index + 1}`,
        },
        teacher
      )
    );
  }

  return [];
}

export function buildDemoGradesForStudents(students = []) {
  const subjects = ['Mathematics', 'Science', 'English'];
  return students.flatMap((student, index) =>
    subjects.map((subject, subjectIndex) => {
      const percentage = 72 + ((index + 1) * 7 + subjectIndex * 5) % 24;
      const max_marks = 100;
      const marks_obtained = Math.round((percentage / 100) * max_marks);
      return {
        id: `${student.id}-${subject}`,
        student_id: student.id,
        student_name: student.full_name,
        roll_number: student.roll_number,
        class_name: student.class_name,
        section: student.section,
        subject,
        assignment_title: `${subject} Assessment ${subjectIndex + 1}`,
        percentage,
        marks_obtained,
        max_marks,
        grade: percentage >= 90 ? 'A' : percentage >= 80 ? 'B' : percentage >= 70 ? 'C' : 'D',
        feedback: percentage >= 85 ? 'Strong understanding and consistent effort.' : 'On track, with room to improve revision habits.',
        graded_at: `2026-04-${String(10 + index + subjectIndex).padStart(2, '0')}T09:00:00`,
      };
    })
  );
}
