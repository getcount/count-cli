import { formatDoctorReport, runDoctorChecks } from '../services/doctor.service.js';

interface RunDoctorCommandParams {
  profileName?: string;
  json?: boolean;
}

export async function runDoctorCommand(params: RunDoctorCommandParams = {}): Promise<number> {
  const doctorResult = await runDoctorChecks({ profileName: params.profileName });

  if (params.json) {
    process.stdout.write(`${JSON.stringify(doctorResult, null, 2)}\n`);
  } else {
    process.stdout.write(formatDoctorReport({ result: doctorResult }));
  }

  return doctorResult.passed ? 0 : 1;
}
