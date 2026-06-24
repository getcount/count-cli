import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_CONFIG_DIRECTORY_NAME, DEFAULT_CONFIG_FILE_NAME } from '../constants.js';

export const DEFAULT_PROFILE_NAME = 'default';
export const ACTIVE_PROFILE_FILE_NAME = 'active-profile';
export const PROFILES_DIRECTORY_NAME = 'profiles';

interface GetConfigDirectoryPathParams {
  homeDirectory?: string;
}

export function getConfigDirectoryPath(params: GetConfigDirectoryPathParams = {}): string {
  const { homeDirectory = os.homedir() } = params;
  return path.join(homeDirectory, DEFAULT_CONFIG_DIRECTORY_NAME);
}

interface GetActiveProfileFilePathParams {
  homeDirectory?: string;
}

export function getActiveProfileFilePath(params: GetActiveProfileFilePathParams = {}): string {
  return path.join(getConfigDirectoryPath(params), ACTIVE_PROFILE_FILE_NAME);
}

interface GetProfilesDirectoryPathParams {
  homeDirectory?: string;
}

export function getProfilesDirectoryPath(params: GetProfilesDirectoryPathParams = {}): string {
  return path.join(getConfigDirectoryPath(params), PROFILES_DIRECTORY_NAME);
}

interface GetProfileCredentialsFilePathParams {
  profileName: string;
  homeDirectory?: string;
}

export function getProfileCredentialsFilePath(params: GetProfileCredentialsFilePathParams): string {
  const { profileName, homeDirectory } = params;
  return path.join(getProfilesDirectoryPath({ homeDirectory }), profileName, DEFAULT_CONFIG_FILE_NAME);
}

interface GetLegacyCredentialsFilePathParams {
  homeDirectory?: string;
}

export function getLegacyCredentialsFilePath(params: GetLegacyCredentialsFilePathParams = {}): string {
  return path.join(getConfigDirectoryPath(params), DEFAULT_CONFIG_FILE_NAME);
}

interface ResolveCredentialsFilePathParams {
  profileName?: string;
  homeDirectory?: string;
}

function profileModeIsActive(params: ResolveCredentialsFilePathParams): boolean {
  const { homeDirectory } = params;
  const configDirectory = getConfigDirectoryPath({ homeDirectory });
  const activeProfileFilePath = path.join(configDirectory, ACTIVE_PROFILE_FILE_NAME);
  const profilesDirectory = path.join(configDirectory, PROFILES_DIRECTORY_NAME);

  if (fs.existsSync(activeProfileFilePath)) {
    return true;
  }

  if (!fs.existsSync(profilesDirectory)) {
    return false;
  }

  try {
    const profileDirectoryEntries = fs.readdirSync(profilesDirectory, { withFileTypes: true });
    return profileDirectoryEntries.some(
      (_entry) => _entry.isDirectory() && fs.existsSync(getProfileCredentialsFilePath({ profileName: _entry.name, homeDirectory })),
    );
  } catch {
    return false;
  }
}

export function resolveCredentialsFilePath(params: ResolveCredentialsFilePathParams = {}): string {
  const { profileName, homeDirectory } = params;

  if (profileName) {
    return getProfileCredentialsFilePath({ profileName, homeDirectory });
  }

  if (profileModeIsActive({ homeDirectory })) {
    const activeProfileName = readActiveProfileNameSync({ homeDirectory });
    return getProfileCredentialsFilePath({ profileName: activeProfileName, homeDirectory });
  }

  return getLegacyCredentialsFilePath({ homeDirectory });
}

interface ReadActiveProfileNameSyncParams {
  homeDirectory?: string;
}

function readActiveProfileNameSync(params: ReadActiveProfileNameSyncParams = {}): string {
  const activeProfileFilePath = getActiveProfileFilePath(params);

  try {
    const profileName = fs.readFileSync(activeProfileFilePath, 'utf8').trim();
    if (profileName) {
      return profileName;
    }
  } catch {
    // Fall through to default profile name.
  }

  return DEFAULT_PROFILE_NAME;
}

interface GetActiveProfileNameParams {
  homeDirectory?: string;
}

export async function getActiveProfileName(params: GetActiveProfileNameParams = {}): Promise<string> {
  if (!profileModeIsActive(params)) {
    return DEFAULT_PROFILE_NAME;
  }

  return readActiveProfileNameSync(params);
}

interface SetActiveProfileNameParams {
  profileName: string;
  homeDirectory?: string;
}

export async function setActiveProfileName(params: SetActiveProfileNameParams): Promise<void> {
  const { profileName, homeDirectory } = params;
  const configDirectory = getConfigDirectoryPath({ homeDirectory });
  const activeProfileFilePath = getActiveProfileFilePath({ homeDirectory });

  await fsPromises.mkdir(configDirectory, { recursive: true, mode: 0o700 });
  await fsPromises.writeFile(activeProfileFilePath, `${profileName.trim()}\n`, { encoding: 'utf8', mode: 0o600 });
}

interface ListProfileNamesParams {
  homeDirectory?: string;
}

export async function listProfileNames(params: ListProfileNamesParams = {}): Promise<string[]> {
  const { homeDirectory } = params;
  const profileNameSet = new Set<string>();
  const profilesDirectory = getProfilesDirectoryPath({ homeDirectory });

  if (fs.existsSync(profilesDirectory)) {
    const profileDirectoryEntries = await fsPromises.readdir(profilesDirectory, { withFileTypes: true });
    for (const profileDirectoryEntry of profileDirectoryEntries) {
      if (!profileDirectoryEntry.isDirectory()) {
        continue;
      }

      const profileCredentialsFilePath = getProfileCredentialsFilePath({
        profileName: profileDirectoryEntry.name,
        homeDirectory,
      });
      if (fs.existsSync(profileCredentialsFilePath)) {
        profileNameSet.add(profileDirectoryEntry.name);
      }
    }
  }

  const legacyCredentialsFilePath = getLegacyCredentialsFilePath({ homeDirectory });
  if (fs.existsSync(legacyCredentialsFilePath) && !profileModeIsActive({ homeDirectory })) {
    profileNameSet.add(DEFAULT_PROFILE_NAME);
  }

  return [...profileNameSet].sort();
}

interface EnsureProfileDirectoryParams {
  profileName: string;
  homeDirectory?: string;
}

export async function ensureProfileDirectory(params: EnsureProfileDirectoryParams): Promise<string> {
  const { profileName, homeDirectory } = params;
  const profileDirectoryPath = path.join(getProfilesDirectoryPath({ homeDirectory }), profileName);

  await fsPromises.mkdir(profileDirectoryPath, { recursive: true, mode: 0o700 });
  return profileDirectoryPath;
}

interface MigrateLegacyCredentialsToProfileParams {
  profileName?: string;
  homeDirectory?: string;
}

export async function migrateLegacyCredentialsToProfile(
  params: MigrateLegacyCredentialsToProfileParams = {},
): Promise<boolean> {
  const profileName = params.profileName ?? DEFAULT_PROFILE_NAME;
  const { homeDirectory } = params;
  const legacyCredentialsFilePath = getLegacyCredentialsFilePath({ homeDirectory });
  const profileCredentialsFilePath = getProfileCredentialsFilePath({ profileName, homeDirectory });

  if (!fs.existsSync(legacyCredentialsFilePath)) {
    return false;
  }

  if (fs.existsSync(profileCredentialsFilePath)) {
    return false;
  }

  await ensureProfileDirectory({ profileName, homeDirectory });
  await fsPromises.copyFile(legacyCredentialsFilePath, profileCredentialsFilePath);
  await setActiveProfileName({ profileName, homeDirectory });
  return true;
}
