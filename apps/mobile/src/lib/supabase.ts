import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

const supabaseUrl =
  extra.supabaseUrl ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  '';

const supabaseAnonKey =
  extra.supabaseAnonKey ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase configuration for mobile app.');
}

const REQUEST_TIMEOUT_MS = 12000;
const READ_RETRY_ATTEMPTS = 3;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const withTimeout = async <T>(
  promise: PromiseLike<T>,
  label = 'request',
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const isTransientError = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  const normalized = message.toLowerCase();
  return (
    normalized.includes('timed out') ||
    normalized.includes('timeout') ||
    normalized.includes('network') ||
    normalized.includes('socket') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('err_')
  );
};

const withReadRetry = async <T>(
  requestFactory: () => PromiseLike<T>,
  label: string,
  attempts = READ_RETRY_ATTEMPTS
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await withTimeout(requestFactory(), label);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isTransientError(error)) {
        throw error;
      }
      await wait(300 * attempt);
    }
  }

  throw lastError ?? new Error(`${label} failed`);
};

const handle = <T>(data: T | null, error: { message: string } | null): T => {
  if (error) {
    throw new Error(error.message);
  }
  return data as T;
};

const uniqueIds = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value))));

const toIdMap = <T extends { id: string }>(items: T[]) =>
  items.reduce<Record<string, T>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

const isColumnMissingError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const typedError = error as { code?: string; message?: string };
  const message = (typedError.message || '').toLowerCase();
  return (
    typedError.code === '42703' ||
    typedError.code === 'PGRST204' ||
    (message.includes('column') && message.includes('does not exist'))
  );
};

const isRelationMissingError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const typedError = error as { code?: string; message?: string };
  const message = (typedError.message || '').toLowerCase();
  return (
    typedError.code === '42P01' ||
    (message.includes('relation') && message.includes('does not exist')) ||
    (message.includes('table') && message.includes('does not exist'))
  );
};

const isMissingFunctionError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const typedError = error as { code?: string; message?: string };
  const message = (typedError.message || '').toLowerCase();
  return (
    typedError.code === '42883' ||
    typedError.code === 'PGRST202' ||
    (message.includes('function') && message.includes('does not exist'))
  );
};

const isPermissionDeniedError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const typedError = error as { code?: string; message?: string };
  const message = (typedError.message || '').toLowerCase();
  return (
    typedError.code === '42501' ||
    typedError.code === '401' ||
    message.includes('permission denied') ||
    message.includes('row-level security') ||
    message.includes('not allowed') ||
    message.includes('unauthorized')
  );
};

const fetchUsersMap = async (ids: Array<string | null | undefined>) => {
  const userIds = uniqueIds(ids);
  if (userIds.length === 0) {
    return {} as Record<string, any>;
  }

  const { data, error } = await withReadRetry(
    () => supabase.from('users').select('id, name, email, role').in('id', userIds),
    'load users map'
  ).catch((reason) => {
    if (isPermissionDeniedError(reason) || isRelationMissingError(reason) || isColumnMissingError(reason)) {
      return { data: [], error: null };
    }
    throw reason;
  });

  const rows = handle<any[]>(data, error).map((item) => ({
    ...item,
    id: String(item.id),
  }));
  return toIdMap(rows);
};

const fetchProjectsMap = async (ids: Array<string | null | undefined>) => {
  const projectIds = uniqueIds(ids);
  if (projectIds.length === 0) {
    return {} as Record<string, any>;
  }

  const { data, error } = await withReadRetry(
    () => supabase.from('projects').select('id, name, status, created_by').in('id', projectIds),
    'load projects map'
  ).catch((reason) => {
    if (isPermissionDeniedError(reason) || isRelationMissingError(reason) || isColumnMissingError(reason)) {
      return { data: [], error: null };
    }
    throw reason;
  });

  const rows = handle<any[]>(data, error).map((item) => ({
    ...item,
    id: String(item.id),
  }));
  return toIdMap(rows);
};

const normalizeProject = (project: any, usersMap: Record<string, any>) => {
  const creator = usersMap[project.created_by] || null;
  return {
    ...project,
    users: creator,
    manager: creator,
  };
};

const normalizeTask = (
  task: any,
  projectsMap: Record<string, any>,
  usersMap: Record<string, any>
) => {
  const project = task.project_id ? projectsMap[task.project_id] || null : null;
  const assignee = task.assignee_id ? usersMap[task.assignee_id] || null : null;

  return {
    ...task,
    project,
    projects: project,
    assignee,
    users: assignee,
  };
};

const normalizeInstallation = (
  installation: any,
  projectsMap: Record<string, any>,
  usersMap: Record<string, any>
) => {
  const project = installation.project_id ? projectsMap[installation.project_id] || null : null;
  const assignee = installation.assignee_id ? usersMap[installation.assignee_id] || null : null;

  return {
    ...installation,
    project,
    projects: project,
    assignee,
    users: assignee,
  };
};

const normalizePurchaseRequest = (
  request: any,
  tasksMap: Record<string, any>,
  installationsMap: Record<string, any>,
  projectsMap: Record<string, any>,
  usersMap: Record<string, any>
) => {
  const task = request.task_id ? tasksMap[request.task_id] || null : null;
  const installation = request.installation_id ? installationsMap[request.installation_id] || null : null;
  const projectId = task?.project_id || installation?.project_id;
  const project = projectId ? projectsMap[projectId] || null : null;
  const creator = request.created_by ? usersMap[request.created_by] || null : null;
  const approver = request.approved_by ? usersMap[request.approved_by] || null : null;

  return {
    ...request,
    creator,
    users: creator,
    approved_by_user: approver,
    task,
    tasks: task,
    installation,
    installations: installation,
    project,
  };
};

const PURCHASE_REQUEST_ITEM_KEYS = ['purchase_request_id', 'request_id'] as const;

const loadPurchaseRequestItems = async (requestId: string) => {
  for (const foreignKey of PURCHASE_REQUEST_ITEM_KEYS) {
    const { data, error } = await withReadRetry(
      () => supabase.from('purchase_request_items').select('*').eq(foreignKey, requestId),
      `load purchase request items by ${foreignKey}`
    );

    if (!error) {
      return data || [];
    }

    if (!isColumnMissingError(error)) {
      throw error;
    }
  }

  return [];
};

const insertPurchaseRequestItems = async (requestId: string, items: Record<string, unknown>[]) => {
  if (items.length === 0) {
    return;
  }

  let lastError: unknown;
  for (const foreignKey of PURCHASE_REQUEST_ITEM_KEYS) {
    const preparedItems = items.map((item) => ({
      ...item,
      [foreignKey]: requestId,
    }));

    const { error } = await supabase.from('purchase_request_items').insert(preparedItems);
    if (!error) {
      return;
    }

    lastError = error;
    if (!isColumnMissingError(error)) {
      throw error;
    }
  }

  throw lastError ?? new Error('Failed to insert purchase request items');
};

const safeSingle = async <T>(
  requestFactory: () => PromiseLike<any>,
  label = 'load record'
) => {
  const { data, error } = await withReadRetry<any>(requestFactory, label);
  if (error?.code === 'PGRST116') {
    return null;
  }
  if (error) {
    throw error;
  }
  return data;
};

const getFallbackUser = (authUser: { id: string; email?: string | null }) => ({
  id: authUser.id,
  auth_user_id: authUser.id,
  email: authUser.email || '',
  name: authUser.email?.split('@')[0] || 'Пользователь',
  role: 'worker',
  is_online: false,
});

const buildFallbackUser = (authUser: { id: string; email?: string | null }) => ({
  id: authUser.id,
  auth_user_id: authUser.id,
  email: authUser.email || '',
  name: authUser.email?.split('@')[0] || '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c',
  role: 'worker',
  is_online: false,
});

type AuthUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

const FALLBACK_NAME = '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c';
const VALID_USER_ROLES = ['worker', 'engineer', 'manager', 'deputy_head', 'admin', 'support'] as const;
type UserRole = (typeof VALID_USER_ROLES)[number];

const resolveAuthRole = (authUser: AuthUserLike): UserRole => {
  const candidate = authUser.user_metadata?.role ?? authUser.app_metadata?.role;
  if (typeof candidate !== 'string') {
    return 'worker';
  }
  return (VALID_USER_ROLES as readonly string[]).includes(candidate)
    ? (candidate as UserRole)
    : 'worker';
};

const resolveAuthName = (authUser: AuthUserLike): string => {
  const metadataName =
    authUser.user_metadata?.name ??
    authUser.user_metadata?.full_name ??
    authUser.app_metadata?.name;

  if (typeof metadataName === 'string' && metadataName.trim()) {
    return metadataName.trim();
  }

  const emailName = authUser.email?.split('@')[0]?.trim();
  return emailName || FALLBACK_NAME;
};

const buildAuthFallbackUser = (authUser: AuthUserLike) => ({
  id: authUser.id,
  auth_user_id: authUser.id,
  email: authUser.email || '',
  name: resolveAuthName(authUser),
  role: resolveAuthRole(authUser),
  is_online: false,
});

const shouldIgnoreProfileLookupError = (error: unknown) =>
  isColumnMissingError(error) || isRelationMissingError(error) || isPermissionDeniedError(error);

const isDuplicateError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const typedError = error as { code?: string; message?: string };
  const message = (typedError.message || '').toLowerCase();
  return (
    typedError.code === '23505' ||
    message.includes('duplicate key') ||
    message.includes('already exists')
  );
};

const normalizeRoleInput = (candidate?: string | null): UserRole => {
  if (!candidate || typeof candidate !== 'string') {
    return 'worker';
  }

  return (VALID_USER_ROLES as readonly string[]).includes(candidate)
    ? (candidate as UserRole)
    : 'worker';
};

const profileBootstrapAttempts = new Set<string>();

const getProfileByAuthUserId = async (authUserId: string) => {
  try {
    return await safeSingle(
      () =>
        supabase
          .from('users')
          .select('*')
          .eq('auth_user_id', authUserId)
          .single(),
      'load user profile'
    );
  } catch (error) {
    if (shouldIgnoreProfileLookupError(error)) {
      return null;
    }
    throw error;
  }
};

const getProfileByUserId = async (userId: string) => {
  try {
    return await safeSingle(
      () =>
        supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single(),
      'load user profile by id'
    );
  } catch (error) {
    if (shouldIgnoreProfileLookupError(error)) {
      return null;
    }
    throw error;
  }
};

const getProfileByEmail = async (email?: string | null) => {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  try {
    return await safeSingle(
      () =>
        supabase
          .from('users')
          .select('*')
          .ilike('email', normalizedEmail)
          .single(),
      'load user profile by email'
    );
  } catch (error) {
    if (shouldIgnoreProfileLookupError(error)) {
      return null;
    }
    throw error;
  }
};

const lookupUserProfile = async (authUser: AuthUserLike) => {
  const candidates = [
    () => getProfileByAuthUserId(authUser.id),
    () => getProfileByUserId(authUser.id),
    () => getProfileByEmail(authUser.email),
  ];

  for (const candidate of candidates) {
    const profile = await candidate();
    if (profile) {
      return profile;
    }
  }

  return null;
};

const createUserProfileRecord = async (
  authUser: AuthUserLike,
  options: { preferredName?: string; preferredRole?: string } = {}
) => {
  const email = authUser.email?.trim().toLowerCase() || '';
  const name = options.preferredName?.trim() || resolveAuthName(authUser);
  const role = normalizeRoleInput(options.preferredRole ?? resolveAuthRole(authUser));

  const attempts: Array<Record<string, unknown>> = [
    { id: authUser.id, auth_user_id: authUser.id, email, name, role },
    { id: authUser.id, email, name, role },
    { auth_user_id: authUser.id, email, name, role },
    { id: authUser.id, email, name },
    { auth_user_id: authUser.id, email, name },
  ];

  for (const rawAttempt of attempts) {
    const attempt = Object.fromEntries(
      Object.entries(rawAttempt).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );

    if (Object.keys(attempt).length === 0) {
      continue;
    }

    const { error } = await supabase.from('users').insert([attempt]).select('id').single();
    if (!error) {
      return;
    }

    if (isDuplicateError(error)) {
      return;
    }

    if (isColumnMissingError(error)) {
      continue;
    }

    if (isPermissionDeniedError(error) || isRelationMissingError(error)) {
      return;
    }

    throw error;
  }
};

type ResolveProfileOptions = {
  createIfMissing?: boolean;
  preferredName?: string;
  preferredRole?: string;
};

const resolveUserProfile = async (authUser: AuthUserLike, options: ResolveProfileOptions = {}) => {
  const fallbackUser = {
    ...buildAuthFallbackUser(authUser),
    ...(options.preferredName?.trim() ? { name: options.preferredName.trim() } : {}),
    ...(options.preferredRole ? { role: normalizeRoleInput(options.preferredRole) } : {}),
  };

  try {
    const existing = await lookupUserProfile(authUser);
    if (existing) {
      return existing as any;
    }

    if (options.createIfMissing && !profileBootstrapAttempts.has(authUser.id)) {
      profileBootstrapAttempts.add(authUser.id);
      await createUserProfileRecord(authUser, {
        preferredName: options.preferredName,
        preferredRole: options.preferredRole,
      }).catch((error) => {
        console.warn('Failed to bootstrap users profile:', error);
      });

      const profileAfterBootstrap = await lookupUserProfile(authUser);
      if (profileAfterBootstrap) {
        return profileAfterBootstrap as any;
      }
    }
  } catch (error) {
    console.warn('Using fallback profile because users query failed:', error);
  }

  return fallbackUser as any;
};

const getCurrentProfile = async () => {
  const {
    data: { user: authUser },
    error,
  } = await withTimeout(supabase.auth.getUser(), 'load auth user');

  if (error || !authUser) {
    throw new Error('Not authenticated');
  }

  return {
    authUser,
    user: await resolveUserProfile(authUser as AuthUserLike, { createIfMissing: true }),
  };
};

export const authApi = {
  login: async (email: string, password: string) => {
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      'sign in',
      12000
    );
    if (error) {
      throw error;
    }

    const profile = await resolveUserProfile(data.user as AuthUserLike, { createIfMissing: true });

    return { token: data.session?.access_token || null, user: profile as any };
  },

  register: async (email: string, password: string, name: string, role: string) => {
    const { data, error } = await withTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, role },
        },
      }),
      'register',
      12000
    );

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('Registration failed');
    }

    let authUser = data.user as AuthUserLike;
    let accessToken = data.session?.access_token || null;
    if (!accessToken) {
      const signInResult = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        'sign in after registration',
        12000
      ).catch(() => null);

      if (signInResult && !(signInResult as any).error) {
        const signInData = (signInResult as any).data || {};
        authUser = (signInData.user || authUser) as AuthUserLike;
        accessToken = signInData.session?.access_token || accessToken;
      }
    }

    const normalizedRole = normalizeRoleInput(role);
    const profile = await resolveUserProfile(authUser, {
      createIfMissing: true,
      preferredName: name,
      preferredRole: normalizedRole,
    });

    return {
      token: accessToken,
      user: {
        ...(profile as any),
        name: (profile as any)?.name || name,
        role: (profile as any)?.role || normalizedRole,
      },
    };
  },

  getMe: async () => {
    const { user } = await getCurrentProfile();
    return { user };
  },

  getUsers: async (role?: string) => {
    const variants = ['id, name, email, role, is_online, last_seen_at', 'id, name, email, role'];
    let lastError: unknown;

    for (const columns of variants) {
      const { data, error } = await withReadRetry(() => {
        let query = supabase.from('users').select(columns).order('name');
        if (role) {
          query = query.eq('role', role);
        }
        return query;
      }, 'load users');

      if (!error) {
        return (data || []) as any[];
      }

      lastError = error;
      if (isColumnMissingError(error)) {
        continue;
      }
      if (isPermissionDeniedError(error) || isRelationMissingError(error)) {
        return [];
      }
      throw error;
    }

    if (lastError) {
      throw lastError as Error;
    }
    return [];
  },
};

const updatePresenceState = async (
  authUser: { id: string },
  user: { id?: string; auth_user_id?: string },
  patch: Record<string, unknown>
) => {
  const candidateIds = uniqueIds([
    user?.id ? String(user.id) : null,
    user?.auth_user_id ? String(user.auth_user_id) : null,
    authUser?.id ? String(authUser.id) : null,
  ]);

  for (const candidateId of candidateIds) {
    const { data, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', candidateId)
      .select('id');

    if (!error && Array.isArray(data) && data.length > 0) {
      return;
    }

    if (error) {
      if (isPermissionDeniedError(error) || isRelationMissingError(error)) {
        return;
      }
      if (!isColumnMissingError(error)) {
        throw error;
      }
    }
  }

  if (!authUser?.id) {
    return;
  }

  const { error } = await supabase
    .from('users')
    .update(patch)
    .eq('auth_user_id', authUser.id)
    .select('id');

  if (!error) {
    return;
  }

  if (
    isColumnMissingError(error) ||
    isPermissionDeniedError(error) ||
    isRelationMissingError(error)
  ) {
    return;
  }

  throw error;
};

export const usersApi = {
  getAll: async () => {
    const variants = [
      'id, name, email, role, is_online, last_seen_at, created_at',
      'id, name, email, role, is_online, last_seen_at',
      'id, name, email, role',
    ];
    let lastError: unknown;

    for (const columns of variants) {
      const { data, error } = await withReadRetry(
        () =>
          supabase
            .from('users')
            .select(columns)
            .order('name', { ascending: true }),
        'load users'
      );

      if (!error) {
        return (data || []) as any[];
      }

      lastError = error;
      if (isColumnMissingError(error)) {
        continue;
      }
      if (isPermissionDeniedError(error) || isRelationMissingError(error)) {
        return [];
      }
      throw error;
    }

    if (lastError) {
      throw lastError as Error;
    }
    return [];
  },

  heartbeat: async () => {
    const { authUser, user } = (await getCurrentProfile()) as any;
    await updatePresenceState(authUser, user, {
      is_online: true,
      last_seen_at: new Date().toISOString(),
    });
  },

  markOffline: async () => {
    try {
      const { authUser, user } = await getCurrentProfile();
      await updatePresenceState(authUser as any, user as any, {
        is_online: false,
        last_seen_at: new Date().toISOString(),
      });
    } catch {
      // Ignore sign-out cleanup errors.
    }
  },
};

export const projectsApi = {
  getAll: async (status?: string) => {
    const { data, error } = await withReadRetry(() => {
      let query = supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      return query;
    }, 'load projects');

    const projects = handle<any[]>(data, error);
    const usersMap = await fetchUsersMap(projects.map((project) => project.created_by));
    return projects.map((project) => normalizeProject(project, usersMap));
  },

  getById: async (id: string) => {
    const { data, error } = await withReadRetry(
      () =>
        supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .single(),
      'load project'
    );

    const project = handle<any>(data, error);
    const usersMap = await fetchUsersMap([project.created_by]);
    return normalizeProject(project, usersMap);
  },

  create: async (project: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('projects')
      .insert([project])
      .select()
      .single();

    return handle(data, error);
  },

  update: async (id: string, project: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('projects')
      .update(project)
      .eq('id', id)
      .select()
      .single();

    return handle(data, error);
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) {
      throw error;
    }
  },
};

export const tasksApi = {
  getAll: async (filters: Record<string, string> = {}) => {
    const { data, error } = await withReadRetry(() => {
      let query = supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.project_id) {
        query = query.eq('project_id', filters.project_id);
      }
      if (filters.assignee_id) {
        query = query.eq('assignee_id', filters.assignee_id);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      return query;
    }, 'load tasks');

    const tasks = handle<any[]>(data, error);
    const projectsMap = await fetchProjectsMap(tasks.map((task) => task.project_id));
    const usersMap = await fetchUsersMap(tasks.map((task) => task.assignee_id));
    return tasks.map((task) => normalizeTask(task, projectsMap, usersMap));
  },

  getById: async (id: string) => {
    const { data, error } = await withReadRetry(
      () =>
        supabase
          .from('tasks')
          .select('*')
          .eq('id', id)
          .single(),
      'load task'
    );

    const task = handle<any>(data, error);
    const [projectsMap, usersMap] = await Promise.all([
      fetchProjectsMap([task.project_id]),
      fetchUsersMap([task.assignee_id]),
    ]);

    return normalizeTask(task, projectsMap, usersMap);
  },

  create: async (task: Record<string, unknown>) => {
    const { user } = (await getCurrentProfile()) as any;
    const payload = { ...task, created_by: user.id };

    const { data, error } = await supabase
      .from('tasks')
      .insert([payload])
      .select()
      .single();

    return handle(data, error);
  },

  update: async (id: string, task: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('tasks')
      .update(task)
      .eq('id', id)
      .select()
      .single();

    return handle(data, error);
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
      throw error;
    }
  },

  getArchived: async () => {
    let archivedData: any[] = [];
    let archivedError: any = null;

    const primary = await supabase
      .from('tasks')
      .select('*')
      .in('status', ['done', 'postponed'])
      .order('updated_at', { ascending: false });

    if (primary.error) {
      const fallback = await supabase
        .from('tasks')
        .select('*')
        .eq('is_archived', true)
        .order('updated_at', { ascending: false });
      archivedData = handle<any[]>(fallback.data, fallback.error);
    } else {
      archivedData = handle<any[]>(primary.data, primary.error);
    }

    const [projectsMap, usersMap] = await Promise.all([
      fetchProjectsMap(archivedData.map((task) => task.project_id)),
      fetchUsersMap(archivedData.map((task) => task.assignee_id)),
    ]);

    return archivedData.map((task) => normalizeTask(task, projectsMap, usersMap));
  },
};

export const installationsApi = {
  getAll: async (filters: Record<string, string> = {}) => {
    const { data, error } = await withReadRetry(() => {
      let query = supabase
        .from('installations')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.project_id) {
        query = query.eq('project_id', filters.project_id);
      }
      if (filters.assignee_id) {
        query = query.eq('assignee_id', filters.assignee_id);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      return query;
    }, 'load installations');

    const installations = handle<any[]>(data, error);
    const [projectsMap, usersMap] = await Promise.all([
      fetchProjectsMap(installations.map((installation) => installation.project_id)),
      fetchUsersMap(installations.map((installation) => installation.assignee_id)),
    ]);

    return installations.map((installation) =>
      normalizeInstallation(installation, projectsMap, usersMap)
    );
  },

  getById: async (id: string) => {
    const { data, error } = await withReadRetry(
      () =>
        supabase
          .from('installations')
          .select('*')
          .eq('id', id)
          .single(),
      'load installation'
    );

    const installation = handle<any>(data, error);

    const [projectsMap, usersMap] = await Promise.all([
      fetchProjectsMap([installation.project_id]),
      fetchUsersMap([installation.assignee_id]),
    ]);

    const { data: purchaseRequests, error: purchaseError } = await withReadRetry(
      () =>
        supabase
          .from('purchase_requests')
          .select('*')
          .eq('installation_id', id)
          .order('created_at', { ascending: false }),
      'load installation purchase requests'
    );

    if (purchaseError) {
      throw purchaseError;
    }

    const normalizedInstallation = normalizeInstallation(installation, projectsMap, usersMap);
    const usersForPurchase = await fetchUsersMap(
      (purchaseRequests || []).flatMap((request: any) => [request.created_by, request.approved_by])
    );

    return {
      ...normalizedInstallation,
      purchase_requests: (purchaseRequests || []).map((request: any) => ({
        ...request,
        creator: usersForPurchase[request.created_by] || null,
        users: usersForPurchase[request.created_by] || null,
        approved_by_user: usersForPurchase[request.approved_by] || null,
      })),
    };
  },

  create: async (installation: Record<string, unknown>) => {
    const { user } = (await getCurrentProfile()) as any;
    const baseTitle =
      typeof installation.title === 'string' && installation.title.trim()
        ? installation.title.trim()
        : typeof installation.address === 'string' && installation.address.trim()
          ? installation.address.trim()
          : 'Монтаж';

    const payload: Record<string, unknown> = {
      ...installation,
      title: baseTitle,
      created_by: user.id,
    };

    if (!payload.scheduled_at && payload.planned_date) {
      payload.scheduled_at = payload.planned_date;
      delete payload.planned_date;
    }

    const { data, error } = await supabase
      .from('installations')
      .insert([payload])
      .select()
      .single();

    return handle(data, error);
  },

  update: async (id: string, installation: Record<string, unknown>) => {
    const payload = { ...installation } as Record<string, unknown>;
    if (!payload.scheduled_at && payload.planned_date) {
      payload.scheduled_at = payload.planned_date;
      delete payload.planned_date;
    }

    const { data, error } = await supabase
      .from('installations')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    return handle(data, error);
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('installations').delete().eq('id', id);
    if (error) {
      throw error;
    }
  },

  getArchived: async () => {
    let archivedData: any[] = [];

    const primary = await supabase
      .from('installations')
      .select('*')
      .in('status', ['done', 'postponed', 'received'])
      .order('updated_at', { ascending: false });

    if (primary.error) {
      const fallback = await supabase
        .from('installations')
        .select('*')
        .eq('is_archived', true)
        .order('updated_at', { ascending: false });
      archivedData = handle<any[]>(fallback.data, fallback.error);
    } else {
      archivedData = handle<any[]>(primary.data, primary.error);
    }

    const [projectsMap, usersMap] = await Promise.all([
      fetchProjectsMap(archivedData.map((installation) => installation.project_id)),
      fetchUsersMap(archivedData.map((installation) => installation.assignee_id)),
    ]);

    return archivedData.map((installation) =>
      normalizeInstallation(installation, projectsMap, usersMap)
    );
  },
};

export const purchaseRequestsApi = {
  getAll: async (filters: Record<string, string> = {}) => {
    const { data, error } = await withReadRetry(() => {
      let query = supabase
        .from('purchase_requests')
        .select('id, status, created_at, updated_at, task_id, task_avr_id, installation_id, created_by, approved_by, comment, receipt_address, received_at')
        .order('created_at', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.created_by) {
        query = query.eq('created_by', filters.created_by);
      }

      return query;
    }, 'load purchase requests');

    const requests = handle<any[]>(data, error);
    if (requests.length === 0) {
      return [];
    }

    const taskIds = uniqueIds(requests.map((request) => request.task_id));
    const installationIds = uniqueIds(requests.map((request) => request.installation_id));
    const usersMap = await fetchUsersMap(
      requests.flatMap((request) => [request.created_by, request.approved_by])
    );

    const [tasksData, installationsData] = await Promise.all([
      taskIds.length > 0
        ? withReadRetry(
            () => supabase.from('tasks').select('id, title, project_id').in('id', taskIds),
            'load purchase request tasks'
          )
        : Promise.resolve({ data: [], error: null }),
      installationIds.length > 0
        ? withReadRetry(
            () => supabase.from('installations').select('id, title, address, project_id').in('id', installationIds),
            'load purchase request installations'
          )
        : Promise.resolve({ data: [], error: null }),
    ]);

    const tasksMap = toIdMap(handle<any[]>(tasksData.data, tasksData.error));
    const installationsMap = toIdMap(handle<any[]>(installationsData.data, installationsData.error));

    const projectsMap = await fetchProjectsMap(
      [
        ...Object.values(tasksMap).map((task: any) => task.project_id),
        ...Object.values(installationsMap).map((installation: any) => installation.project_id),
      ]
    );

    return requests.map((request) =>
      normalizePurchaseRequest(request, tasksMap, installationsMap, projectsMap, usersMap)
    );
  },

  getById: async (id: string) => {
    const { data, error } = await withReadRetry(
      () =>
        supabase
          .from('purchase_requests')
          .select('*')
          .eq('id', id)
          .single(),
      'load purchase request'
    );

    const request = handle<any>(data, error);
    const [items, usersMap] = await Promise.all([
      loadPurchaseRequestItems(id),
      fetchUsersMap([request.created_by, request.approved_by]),
    ]);

    const [taskResult, installationResult] = await Promise.all([
      request.task_id
        ? withReadRetry(
            () =>
              supabase
                .from('tasks')
                .select('id, title, project_id')
                .eq('id', request.task_id)
                .single(),
            'load purchase request task'
          )
        : Promise.resolve({ data: null, error: null }),
      request.installation_id
        ? withReadRetry(
            () =>
              supabase
                .from('installations')
                .select('id, title, address, project_id')
                .eq('id', request.installation_id)
                .single(),
            'load purchase request installation'
          )
        : Promise.resolve({ data: null, error: null }),
    ]);

    const task = taskResult.data && !taskResult.error ? taskResult.data : null;
    const installation = installationResult.data && !installationResult.error ? installationResult.data : null;

    const projectsMap = await fetchProjectsMap([task?.project_id, installation?.project_id]);
    const normalized = normalizePurchaseRequest(
      request,
      task ? { [task.id]: task } : {},
      installation ? { [installation.id]: installation } : {},
      projectsMap,
      usersMap
    );

    return {
      ...normalized,
      items,
    };
  },

  create: async (request: Record<string, any>) => {
    const { items = [], ...rest } = request;
    const { user } = (await getCurrentProfile()) as any;

    const { data: createdRequest, error: requestError } = await supabase
      .from('purchase_requests')
      .insert([{ ...rest, created_by: user.id }])
      .select()
      .single();

    if (requestError) {
      throw requestError;
    }

    await insertPurchaseRequestItems(createdRequest.id, items as Record<string, unknown>[]);
    return createdRequest;
  },

  updateStatus: async (id: string, status: string, comment?: string) => {
    const { user } = await getCurrentProfile();
    const payload: Record<string, unknown> = {
      status,
      comment,
      updated_at: new Date().toISOString(),
    };

    if (status === 'approved' || status === 'rejected' || status === 'completed' || status === 'done' || status === 'received') {
      payload.approved_by = user.id;
    }

    const { data, error } = await supabase
      .from('purchase_requests')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    return handle(data, error);
  },
};

export const materialsApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('name');

    return handle(data, error);
  },

  search: async (searchTerm: string) => {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .ilike('name', `%${searchTerm}%`)
      .order('name');

    return handle(data, error);
  },

  create: async (payload: { name: string; category?: string; default_unit?: string }) => {
    if (!payload.name?.trim()) {
      throw new Error('Название материала обязательно');
    }

    const { data, error } = await supabase
      .from('materials')
      .insert({
        name: payload.name.trim(),
        category: payload.category?.trim() || 'Расходники',
        default_unit: payload.default_unit || 'pcs',
      })
      .select()
      .single();

    return handle(data, error);
  },
};

export const warehouseApi = {
  getAll: async () => {
    const { data, error } = await withReadRetry(
      () =>
        supabase
          .from('warehouse')
          .select('*')
          .order('updated_at', { ascending: false }),
      'load warehouse'
    );

    const rows = handle<any[]>(data, error);
    const materialIds = uniqueIds(rows.map((row) => row.material_id));
    const { data: materials, error: materialsError } = materialIds.length
      ? await withReadRetry(
          () => supabase.from('materials').select('*').in('id', materialIds),
          'load warehouse materials'
        )
      : { data: [], error: null };

    if (materialsError) {
      throw materialsError;
    }

    const materialsMap = toIdMap(handle<any[]>(materials, materialsError));
    return rows.map((row: any) => {
      const quantity =
        typeof row.quantity_available === 'number'
          ? row.quantity_available
          : typeof row.quantity === 'number'
            ? row.quantity
            : 0;

      return {
        ...row,
        material: row.material_id ? materialsMap[row.material_id] || null : null,
        id: row.id || row.material_id,
        quantity_available: quantity,
      };
    });
  },

  getIssueMeta: async () => {
    const { data: stockRows, error: stockError } = await withReadRetry(
      () =>
        supabase
          .from('warehouse')
          .select('id, material_id, quantity_available, quantity')
          .gt('quantity_available', 0),
      'load in-stock warehouse rows'
    ).catch(async (reason) => {
      if (!isColumnMissingError(reason)) {
        throw reason;
      }

      return withReadRetry(
        () =>
          supabase
            .from('warehouse')
            .select('id, material_id, quantity_available, quantity')
            .gt('quantity', 0),
        'load in-stock warehouse rows (quantity fallback)'
      );
    });

    const rows = handle<any[]>(stockRows, stockError);
    const stockByMaterial = rows.reduce<Record<string, number>>((acc, row) => {
      const value =
        typeof row.quantity_available === 'number'
          ? row.quantity_available
          : typeof row.quantity === 'number'
            ? row.quantity
            : 0;
      if (row.material_id) {
        acc[row.material_id] = value;
      }
      return acc;
    }, {});

    const materialIds = uniqueIds(rows.map((row) => row.material_id));
    const [materialsResult, usersResult, avrResult] = await Promise.all([
      materialIds.length
        ? withReadRetry(
            () =>
              supabase
                .from('materials')
                .select('id, name, category, default_unit')
                .in('id', materialIds)
                .order('category', { ascending: true })
                .order('name', { ascending: true }),
            'load issue materials'
          )
        : Promise.resolve({ data: [], error: null }),
      withReadRetry(
        () => supabase.from('users').select('id, name, role').order('name', { ascending: true }),
        'load users for warehouse issue'
      ),
      withReadRetry(
        () =>
          supabase
            .from('tasks_avr')
            .select('id, title, type, short_id, status, created_at')
            .order('created_at', { ascending: false })
            .limit(50),
        'load avr tasks for warehouse issue'
      ).catch((reason) => {
        if (isRelationMissingError(reason)) {
          return { data: [], error: null };
        }
        throw reason;
      }),
    ]);

    const materials = handle<any[]>(materialsResult.data, materialsResult.error).map((material) => ({
      ...material,
      stock: stockByMaterial[material.id] || 0,
    }));
    const users = handle<any[]>(usersResult.data, usersResult.error);
    const avrTasks = handle<any[]>(avrResult.data, avrResult.error).filter((task) =>
      !['done', 'archived', 'completed', 'cancelled'].includes(String(task.status || '').toLowerCase())
    );

    return { materials, users, avrTasks };
  },

  addStock: async (payload: {
    material_id: string;
    quantity: number;
    location?: string | null;
    notes?: string | null;
  }) => {
    if (!payload.material_id) {
      throw new Error('Материал не выбран');
    }
    if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
      throw new Error('Количество должно быть больше нуля');
    }

    const { data: existingData, error: existingError } = await supabase
      .from('warehouse')
      .select('*')
      .eq('material_id', payload.material_id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const nowIso = new Date().toISOString();
    const existing = existingData as Record<string, any> | null;

    const cleanPayload = (value: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

    if (existing) {
      const currentQty =
        typeof existing.quantity_available === 'number'
          ? existing.quantity_available
          : typeof existing.quantity === 'number'
            ? existing.quantity
            : 0;
      const nextQty = currentQty + payload.quantity;

      const updateAttempts = [
        cleanPayload({
          quantity_available: nextQty,
          location: payload.location || existing.location || null,
          last_updated: nowIso,
          updated_at: nowIso,
        }),
        cleanPayload({
          quantity_available: nextQty,
          location: payload.location || existing.location || null,
          updated_at: nowIso,
        }),
        cleanPayload({
          quantity: nextQty,
          location: payload.location || existing.location || null,
          last_updated: nowIso,
          updated_at: nowIso,
        }),
        cleanPayload({
          quantity: nextQty,
          location: payload.location || existing.location || null,
          updated_at: nowIso,
        }),
      ];

      let lastError: unknown;
      for (const attempt of updateAttempts) {
        const { data, error } = await supabase
          .from('warehouse')
          .update(attempt)
          .eq('id', existing.id)
          .select()
          .single();

        if (!error) {
          return data;
        }

        lastError = error;
        if (!isColumnMissingError(error)) {
          throw error;
        }
      }

      throw lastError ?? new Error('Не удалось обновить склад');
    }

    const insertAttempts = [
      cleanPayload({
        material_id: payload.material_id,
        quantity_available: payload.quantity,
        quantity_reserved: 0,
        location: payload.location || null,
        notes: payload.notes || null,
        last_updated: nowIso,
        updated_at: nowIso,
      }),
      cleanPayload({
        material_id: payload.material_id,
        quantity_available: payload.quantity,
        location: payload.location || null,
        last_updated: nowIso,
      }),
      cleanPayload({
        material_id: payload.material_id,
        quantity: payload.quantity,
        quantity_reserved: 0,
        location: payload.location || null,
        updated_at: nowIso,
      }),
      cleanPayload({
        material_id: payload.material_id,
        quantity: payload.quantity,
        location: payload.location || null,
      }),
    ];

    let lastInsertError: unknown;
    for (const attempt of insertAttempts) {
      const { data, error } = await supabase
        .from('warehouse')
        .insert(attempt)
        .select()
        .single();

      if (!error) {
        return data;
      }

      lastInsertError = error;
      if (!isColumnMissingError(error)) {
        throw error;
      }
    }

    throw lastInsertError ?? new Error('Не удалось добавить материал на склад');
  },

  createIssue: async (payload: {
    issued_to: string;
    issued_at: string;
    purpose?: string | null;
    task_avr_id?: string | null;
    items: Array<{ material_id: string; quantity: number }>;
  }) => {
    if (!payload.issued_to) {
      throw new Error('Не выбран сотрудник для выдачи');
    }
    if (!payload.issued_at) {
      throw new Error('Не указана дата выдачи');
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error('Добавьте хотя бы одну позицию');
    }

    const normalizedItems = payload.items
      .map((item) => ({
        material_id: item.material_id,
        quantity: Number(item.quantity),
      }))
      .filter((item) => Boolean(item.material_id) && Number.isFinite(item.quantity) && item.quantity > 0);

    if (normalizedItems.length === 0) {
      throw new Error('Некорректные позиции выдачи');
    }

    const materialIds = uniqueIds(normalizedItems.map((item) => item.material_id));
    const { data: stockRows, error: stockError } = await withReadRetry(
      () =>
        supabase
          .from('warehouse')
          .select('id, material_id, quantity_available, quantity')
          .in('material_id', materialIds),
      'load warehouse stock for issue'
    );
    const stock = handle<any[]>(stockRows, stockError);
    const stockMap = stock.reduce<Record<string, any>>((acc, row) => {
      acc[row.material_id] = row;
      return acc;
    }, {});

    for (const item of normalizedItems) {
      const row = stockMap[item.material_id];
      const available =
        typeof row?.quantity_available === 'number'
          ? row.quantity_available
          : typeof row?.quantity === 'number'
            ? row.quantity
            : 0;
      if (available < item.quantity) {
        throw new Error('Недостаточно материала на складе');
      }
    }

    const { user } = await getCurrentProfile();
    const issuePayload = {
      issued_at: payload.issued_at,
      issued_to: payload.issued_to,
      purpose: payload.purpose || null,
      task_avr_id: payload.task_avr_id || null,
      created_by: user.id,
    };

    const issueAttempts = [issuePayload, { ...issuePayload, created_by: undefined }];
    let issue: any = null;
    let issueError: unknown = null;

    for (const attemptRaw of issueAttempts) {
      const attempt = Object.fromEntries(
        Object.entries(attemptRaw).filter(([, value]) => value !== undefined)
      );

      const { data, error } = await supabase
        .from('warehouse_issues')
        .insert(attempt)
        .select()
        .single();

      if (!error) {
        issue = data;
        issueError = null;
        break;
      }

      issueError = error;
      if (!isColumnMissingError(error)) {
        throw error;
      }
    }

    if (!issue) {
      throw issueError ?? new Error('Не удалось создать выдачу');
    }

    const { error: itemsError } = await supabase.from('warehouse_issue_items').insert(
      normalizedItems.map((item) => ({
        issue_id: issue.id,
        material_id: item.material_id,
        quantity: item.quantity,
      }))
    );

    if (itemsError) {
      throw itemsError;
    }

    for (const item of normalizedItems) {
      const row = stockMap[item.material_id];
      const currentQty =
        typeof row?.quantity_available === 'number'
          ? row.quantity_available
          : typeof row?.quantity === 'number'
            ? row.quantity
            : 0;
      const nextQty = Math.max(0, currentQty - item.quantity);
      const nowIso = new Date().toISOString();

      const attempts = [
        { quantity_available: nextQty, last_updated: nowIso, updated_at: nowIso },
        { quantity_available: nextQty, updated_at: nowIso },
        { quantity: nextQty, last_updated: nowIso, updated_at: nowIso },
        { quantity: nextQty, updated_at: nowIso },
      ];

      let lastError: unknown;
      for (const attempt of attempts) {
        const { error } = await supabase
          .from('warehouse')
          .update(attempt)
          .eq('id', row.id);

        if (!error) {
          lastError = null;
          break;
        }

        lastError = error;
        if (!isColumnMissingError(error)) {
          throw error;
        }
      }

      if (lastError) {
        throw lastError;
      }
    }

    return issue;
  },

  getIssueHistory: async (limit = 100) => {
    const { data: issuesData, error: issuesError } = await withReadRetry(
      () =>
        supabase
          .from('warehouse_issues')
          .select('id, issued_at, purpose, task_avr_id, issued_to, created_at')
          .order('issued_at', { ascending: false })
          .limit(limit),
      'load warehouse issues'
    );

    const issues = handle<any[]>(issuesData, issuesError);
    if (issues.length === 0) {
      return [];
    }

    const issueIds = issues.map((issue) => issue.id);
    const userIds = uniqueIds(issues.map((issue) => issue.issued_to));

    const [usersResult, itemsResult] = await Promise.all([
      userIds.length
        ? withReadRetry(
            () => supabase.from('users').select('id, name').in('id', userIds),
            'load issue history users'
          )
        : Promise.resolve({ data: [], error: null }),
      withReadRetry(
        () =>
          supabase
            .from('warehouse_issue_items')
            .select('issue_id, material_id, quantity')
            .in('issue_id', issueIds),
        'load issue history items'
      ),
    ]);

    const usersMap = toIdMap(handle<any[]>(usersResult.data, usersResult.error));
    const issueItems = handle<any[]>(itemsResult.data, itemsResult.error);
    const materialIds = uniqueIds(issueItems.map((item) => item.material_id));

    const { data: materialsData, error: materialsError } = materialIds.length
      ? await withReadRetry(
          () =>
            supabase
              .from('materials')
              .select('id, name, default_unit')
              .in('id', materialIds),
          'load issue history materials'
        )
      : { data: [], error: null };

    const materialsMap = toIdMap(handle<any[]>(materialsData, materialsError));
    const itemsByIssue = issueItems.reduce<Record<string, any[]>>((acc, item) => {
      if (!acc[item.issue_id]) {
        acc[item.issue_id] = [];
      }
      acc[item.issue_id].push({
        ...item,
        material: item.material_id ? materialsMap[item.material_id] || null : null,
      });
      return acc;
    }, {});

    return issues.map((issue) => ({
      ...issue,
      issued_to_user: issue.issued_to ? usersMap[issue.issued_to] || null : null,
      items: itemsByIssue[issue.id] || [],
    }));
  },
};

type CommentEntityType = 'task' | 'installation';

export const commentsApi = {
  getByEntity: async (entityId: string, entityType: CommentEntityType) => {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('entity_id', entityId)
      .eq('entity_type', entityType)
      .order('created_at', { ascending: true });

    const comments = handle<any[]>(data, error);
    const usersMap = await fetchUsersMap(comments.map((comment) => comment.user_id));

    return comments.map((comment) => ({
      ...comment,
      author: comment.user_id ? usersMap[comment.user_id] || null : null,
    }));
  },

  create: async (entityId: string, content: string, entityType: CommentEntityType) => {
    const { user } = await getCurrentProfile();
    const { data, error } = await supabase
      .from('comments')
      .insert([
        {
          entity_id: entityId,
          entity_type: entityType,
          user_id: user.id,
          content,
        },
      ])
      .select()
      .single();

    return handle(data, error);
  },

  subscribe: (entityId: string, entityType: CommentEntityType, onChange: () => void) =>
    supabase
      .channel(`comments-${entityType}-${entityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `entity_id=eq.${entityId}`,
        },
        (payload) => {
          if (payload.new && (payload.new as Record<string, unknown>).entity_type !== entityType) {
            return;
          }
          onChange();
        }
      )
      .subscribe(),
};

type ChatListItem = {
  chat_id: string;
  chat_name: string;
  chat_type: string;
  created_by?: string | null;
  pinned: boolean;
  muted: boolean;
  unread_count: number;
  members_count: number;
  partner: any | null;
  last_message: any | null;
};

const CHAT_LAST_SEEN_PREFIX = 'chat_last_seen_';
const CHAT_LAST_SEEN_FALLBACK = '2026-01-01T00:00:00.000Z';

const getChatLastSeenKey = (chatId: string) => `${CHAT_LAST_SEEN_PREFIX}${chatId}`;

const loadChatLastSeenMap = async (chatIds: string[]) => {
  if (chatIds.length === 0) {
    return {} as Record<string, string>;
  }

  const entries = await AsyncStorage.multiGet(chatIds.map(getChatLastSeenKey));
  return entries.reduce<Record<string, string>>((acc, [key, value]) => {
    if (!value) {
      return acc;
    }
    const chatId = key.replace(CHAT_LAST_SEEN_PREFIX, '');
    acc[chatId] = value;
    return acc;
  }, {});
};

const countUnreadMessages = async (chatId: string, lastSeen: string, currentUserId: string) => {
  const buildBase = () =>
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('chat_id', chatId)
      .gt('created_at', lastSeen);

  const byUserId = await withReadRetry(
    () => buildBase().neq('user_id', currentUserId),
    `count unread by user_id for chat ${chatId}`
  );

  if (!byUserId.error) {
    return byUserId.count || 0;
  }

  if (!isColumnMissingError(byUserId.error)) {
    throw byUserId.error;
  }

  const bySenderId = await withReadRetry(
    () => buildBase().neq('sender_id', currentUserId),
    `count unread by sender_id for chat ${chatId}`
  );

  if (!bySenderId.error) {
    return bySenderId.count || 0;
  }

  if (!isColumnMissingError(bySenderId.error)) {
    throw bySenderId.error;
  }

  const fallback = await withReadRetry(
    () => buildBase(),
    `count unread fallback for chat ${chatId}`
  );

  if (fallback.error) {
    throw fallback.error;
  }

  return fallback.count || 0;
};

const getMessageAuthorId = (message: Record<string, any>) =>
  (message.user_id as string | null | undefined) ||
  (message.sender_id as string | null | undefined) ||
  null;

const getMessageText = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (content && typeof content === 'object') {
    const typed = content as Record<string, unknown>;
    const candidate = typed.text ?? typed.message ?? typed.content;
    return typeof candidate === 'string' ? candidate : '';
  }

  return '';
};

const insertChatMessage = async (payload: {
  chat_id: string;
  userId: string;
  content: Record<string, unknown>;
  messageType?: string;
  jobId?: string | null;
}) => {
  const messageType = payload.messageType || 'text';
  const applyOptionalFields = (base: Record<string, unknown>) => ({
    ...base,
    ...(messageType ? { type: messageType } : {}),
    ...(payload.jobId ? { job_id: payload.jobId } : {}),
  });

  const attempts = [
    applyOptionalFields({ chat_id: payload.chat_id, user_id: payload.userId, content: payload.content }),
    { chat_id: payload.chat_id, user_id: payload.userId, content: payload.content },
    applyOptionalFields({ chat_id: payload.chat_id, sender_id: payload.userId, content: payload.content }),
    { chat_id: payload.chat_id, sender_id: payload.userId, content: payload.content },
    applyOptionalFields({ chat_id: payload.chat_id, content: payload.content }),
    { chat_id: payload.chat_id, content: payload.content },
    payload.jobId
      ? { chat_id: payload.chat_id, user_id: payload.userId, content: payload.content, job_id: payload.jobId }
      : null,
  ].filter(Boolean) as Record<string, unknown>[];

  let lastError: unknown;
  for (const attempt of attempts) {
    const { data, error } = await supabase.from('messages').insert([attempt]).select().single();
    if (!error) {
      return data;
    }

    lastError = error;
    if (!isColumnMissingError(error)) {
      throw error;
    }
  }

  throw lastError ?? new Error('Failed to insert chat message');
};

export const chatApi = {
  getChats: async (): Promise<ChatListItem[]> => {
    const { authUser, user } = await getCurrentProfile();
    const currentUserIds = uniqueIds([
      user?.id ? String(user.id) : null,
      (user as any)?.auth_user_id ? String((user as any).auth_user_id) : null,
      authUser?.id ? String(authUser.id) : null,
    ]);
    const currentUserId = currentUserIds[0] || String(authUser.id);
    const currentUserIdSet = new Set(currentUserIds);

    if (!currentUserIds.length) {
      return [];
    }

    const { data: membershipData, error: membershipError } = await withReadRetry(
      () =>
        supabase
          .from('chat_members')
          .select('*')
          .in('user_id', currentUserIds),
        'load chat memberships'
    );

    if (membershipError) {
      if (isPermissionDeniedError(membershipError) || isRelationMissingError(membershipError)) {
        return [];
      }
      throw membershipError;
    }

    const memberships = handle<any[]>(membershipData, membershipError);
    const chatIds = uniqueIds(memberships.map((membership) => membership.chat_id));
    if (!chatIds.length) {
      return [];
    }

    const [chatsResult, allMembersResult, lastMessagesResult] = await Promise.all([
      withReadRetry(() => supabase.from('chats').select('*').in('id', chatIds), 'load chats'),
      withReadRetry(
        () =>
          supabase
            .from('chat_members')
            .select('chat_id, user_id')
            .in('chat_id', chatIds),
        'load all chat members'
      ),
      withReadRetry(
        () =>
          supabase
            .from('messages')
            .select('*')
            .in('chat_id', chatIds)
            .order('created_at', { ascending: false })
            .limit(chatIds.length * 5),
        'load last chat messages'
      ),
    ]);

    const chats = handle<any[]>(chatsResult.data, chatsResult.error);
    const allMembers = handle<any[]>(allMembersResult.data, allMembersResult.error);
    const lastMessages = handle<any[]>(lastMessagesResult.data, lastMessagesResult.error);

    const chatsMap = toIdMap(chats.map((chat) => ({ ...chat, id: chat.id as string })));
    const membershipMap = memberships.reduce<Record<string, any>>((acc, membership) => {
      const existing = acc[membership.chat_id];
      if (!existing || String(existing.user_id) !== currentUserId) {
        acc[membership.chat_id] = membership;
      }
      return acc;
    }, {});

    const membersByChat = allMembers.reduce<Record<string, any[]>>((acc, membership) => {
      if (!acc[membership.chat_id]) {
        acc[membership.chat_id] = [];
      }
      acc[membership.chat_id].push(membership);
      return acc;
    }, {});

    const otherMemberIds = uniqueIds(
      allMembers
        .filter((member) => !currentUserIdSet.has(String(member.user_id)))
        .map((member) => member.user_id)
    );
    const usersMap = await fetchUsersMap(otherMemberIds);

    const latestMessageByChat = lastMessages.reduce<Record<string, any>>((acc, message) => {
      if (!acc[message.chat_id]) {
        acc[message.chat_id] = message;
      }
      return acc;
    }, {});

    const lastSeenMap = await loadChatLastSeenMap(chatIds);
    const unreadEntries = await Promise.all(
      chatIds.map(async (chatId) => {
        const lastSeen = lastSeenMap[chatId] || CHAT_LAST_SEEN_FALLBACK;
        const unreadCount = await countUnreadMessages(chatId, lastSeen, currentUserId).catch((error) => {
          console.warn(`Failed to load unread count for chat ${chatId}:`, error);
          return 0;
        });
        return [chatId, unreadCount] as const;
      })
    );
    const unreadMap = unreadEntries.reduce<Record<string, number>>((acc, [chatId, unread]) => {
      acc[chatId] = unread;
      return acc;
    }, {});

    const normalizedChats = chatIds.reduce<ChatListItem[]>((acc, chatId) => {
      const chat = chatsMap[chatId];
      if (!chat) {
        return acc;
      }

      const memberInfo = membershipMap[chatId] || {};
      const members = membersByChat[chatId] || [];
      const partnerMember = members.find((member) => !currentUserIdSet.has(String(member.user_id)));
      const partner = partnerMember?.user_id ? usersMap[partnerMember.user_id] || null : null;
      const type = (chat.type as string | undefined) || 'private';
      const rawName = (chat.name as string | null | undefined)?.trim();
      const normalizedChatName =
        type === 'group' ? rawName || 'Группа' : partner?.name || rawName || 'Чат';
      const chatName = type === 'group' ? rawName || 'Группа' : partner?.name || rawName || 'Чат';

      const lastMessage = latestMessageByChat[chatId] || null;
      const normalizedChat: ChatListItem = {
        chat_id: chatId,
        chat_name: normalizedChatName,
        chat_type: type,
        created_by: (chat.created_by as string | null | undefined) || null,
        pinned: Boolean(memberInfo.pinned),
        muted: Boolean(memberInfo.muted),
        unread_count: unreadMap[chatId] || 0,
        members_count: members.length || 1,
        partner,
        last_message: lastMessage
          ? {
              ...lastMessage,
              text: getMessageText(lastMessage.content),
            }
          : null,
      };

      acc.push(normalizedChat);
      return acc;
    }, []);

    return normalizedChats.sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      const aTime = a.last_message?.created_at || '';
      const bTime = b.last_message?.created_at || '';
      if (aTime !== bTime) {
        return aTime > bTime ? -1 : 1;
      }
      return a.chat_name.localeCompare(b.chat_name, 'ru');
    });
  },

  getMessages: async (chatId: string) => {
    const { data, error } = await withReadRetry(
      () =>
        supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true })
          .limit(250),
      'load chat messages'
    );

    const messages = handle<any[]>(data, error);
    const senderIds = uniqueIds(messages.map((message) => getMessageAuthorId(message)));
    const usersMap = await fetchUsersMap(senderIds);

    let receiptsByMessage: Record<string, any[]> = {};
    const messageIds = messages.map((message) => message.id).filter(Boolean);
    if (messageIds.length) {
      const receiptsResult = await withReadRetry(
        () =>
          supabase
            .from('message_read_receipts')
            .select('*')
            .in('message_id', messageIds),
        'load message read receipts'
      ).catch((reason) => {
        if (isRelationMissingError(reason)) {
          return { data: [], error: null };
        }
        throw reason;
      });

      const receipts = handle<any[]>(receiptsResult.data, receiptsResult.error);
      receiptsByMessage = receipts.reduce<Record<string, any[]>>((acc, receipt) => {
        if (!acc[receipt.message_id]) {
          acc[receipt.message_id] = [];
        }
        acc[receipt.message_id].push(receipt);
        return acc;
      }, {});
    }

    const jobIds = uniqueIds(
      messages.map((message) => {
        const value = message.job_id;
        if (typeof value === 'string' && value.trim()) {
          return value;
        }
        if (typeof value === 'number') {
          return String(value);
        }
        return null;
      })
    );

    let jobsById: Record<string, any> = {};
    if (jobIds.length) {
      const jobsResult = await withReadRetry(
        () =>
          supabase
            .from('jobs')
            .select('*')
            .in('id', jobIds),
        'load message jobs'
      ).catch((reason) => {
        if (isRelationMissingError(reason) || isColumnMissingError(reason)) {
          return { data: [], error: null };
        }
        throw reason;
      });

      const jobs = handle<any[]>(jobsResult.data, jobsResult.error);
      const engineersMap = await fetchUsersMap(jobs.map((job) => job.engineer_id));
      jobsById = jobs.reduce<Record<string, any>>((acc, job) => {
        acc[String(job.id)] = {
          ...job,
          engineer: job.engineer_id ? engineersMap[job.engineer_id] || null : null,
        };
        return acc;
      }, {});
    }

    return messages.map((message) => {
      const authorId = getMessageAuthorId(message);
      const jobKey =
        typeof message.job_id === 'string'
          ? message.job_id
          : typeof message.job_id === 'number'
            ? String(message.job_id)
            : '';

      return {
        ...message,
        text: getMessageText(message.content),
        author_id: authorId,
        sender: authorId ? usersMap[authorId] || null : null,
        job: jobKey ? jobsById[jobKey] || null : null,
        read_receipts: receiptsByMessage[message.id] || [],
      };
    });
  },

  sendMessage: async (chatId: string, text: string, replyTo?: Record<string, unknown> | null) => {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Сообщение пустое');
    }

    const { user } = await getCurrentProfile();
    const content: Record<string, unknown> = { text: trimmed };
    if (replyTo) {
      content.reply_to = replyTo;
    }

    try {
      return await insertChatMessage({
        chat_id: chatId,
        userId: user.id,
        content,
      });
    } catch (error) {
      if (!isPermissionDeniedError(error)) {
        throw error;
      }

      const { data, error: edgeError } = await supabase.functions.invoke('chat-send', {
        body: {
          chat_id: chatId,
          content: trimmed,
        },
      });

      if (edgeError) {
        throw edgeError;
      }

      return (data as Record<string, unknown> | null)?.message || data;
    }
  },

  markChatAsRead: async (chatId: string) => {
    const nowIso = new Date().toISOString();
    await AsyncStorage.setItem(getChatLastSeenKey(chatId), nowIso);

    const attempts: Array<{ fn: string; args: Record<string, unknown> }> = [
      { fn: 'mark_chat_messages_as_read', args: { chat_id_param: chatId } },
      { fn: 'mark_chat_messages_as_read', args: { chat_id: chatId } },
      { fn: 'mark_chat_messages_as_read', args: { p_chat_id: chatId } },
    ];

    for (const attempt of attempts) {
      const { error } = await supabase.rpc(attempt.fn, attempt.args);
      if (!error) {
        return;
      }

      if (isMissingFunctionError(error) || isColumnMissingError(error)) {
        continue;
      }

      console.warn('Failed to mark chat as read via RPC:', error);
      return;
    }
  },

  setPinned: async (chatId: string, pinned: boolean) => {
    const { user } = await getCurrentProfile();
    const { data, error } = await supabase
      .from('chat_members')
      .update({ pinned })
      .eq('chat_id', chatId)
      .eq('user_id', user.id)
      .select('pinned')
      .single();

    if (error) {
      if (isColumnMissingError(error)) {
        throw new Error('В базе отсутствует поле pinned у chat_members');
      }
      throw error;
    }

    return Boolean((data as Record<string, unknown> | null)?.pinned ?? pinned);
  },

  setMuted: async (chatId: string, muted: boolean) => {
    const { user } = await getCurrentProfile();
    const { data, error } = await supabase
      .from('chat_members')
      .update({ muted })
      .eq('chat_id', chatId)
      .eq('user_id', user.id)
      .select('muted')
      .single();

    if (error) {
      if (isColumnMissingError(error)) {
        throw new Error('В базе отсутствует поле muted у chat_members');
      }
      throw error;
    }

    return Boolean((data as Record<string, unknown> | null)?.muted ?? muted);
  },

  getContacts: async (search = '') => {
    const { authUser, user } = await getCurrentProfile();
    const currentUserIds = new Set(
      uniqueIds([
        user?.id ? String(user.id) : null,
        (user as any)?.auth_user_id ? String((user as any).auth_user_id) : null,
        authUser?.id ? String(authUser.id) : null,
      ])
    );

    let query = supabase
      .from('users')
      .select('id, name, role, is_online, last_seen_at')
      .order('name', { ascending: true })
      .limit(80);

    const term = search.trim();
    if (term) {
      query = query.ilike('name', `%${term}%`);
    }

    const { data, error } = await withReadRetry(() => query, 'load chat contacts');
    if (error) {
      if (isPermissionDeniedError(error) || isRelationMissingError(error) || isColumnMissingError(error)) {
        return [];
      }
      throw error;
    }
    return ((data || []) as any[]).filter((item) => !currentUserIds.has(String(item.id)));
  },

  openPrivateChat: async (partnerId: string) => {
    const { authUser, user } = await getCurrentProfile();
    const actorIds = uniqueIds([
      user?.id ? String(user.id) : null,
      (user as any)?.auth_user_id ? String((user as any).auth_user_id) : null,
      authUser?.id ? String(authUser.id) : null,
    ]);
    const primaryActorId = actorIds[0] || String(authUser.id);

    if (!partnerId || actorIds.includes(partnerId)) {
      throw new Error('Некорректный собеседник');
    }

    const [mineResult, partnerResult] = await Promise.all([
      withReadRetry(
        () =>
          supabase
            .from('chat_members')
            .select('chat_id')
            .in('user_id', actorIds),
        'load my chat memberships'
      ),
      withReadRetry(
        () =>
          supabase
            .from('chat_members')
            .select('chat_id')
            .eq('user_id', partnerId),
        'load partner chat memberships'
      ),
    ]);

    const myChatIds = new Set(handle<any[]>(mineResult.data, mineResult.error).map((item) => item.chat_id));
    const partnerChatIds = new Set(
      handle<any[]>(partnerResult.data, partnerResult.error).map((item) => item.chat_id)
    );
    const commonChatIds = [...myChatIds].filter((chatId) => partnerChatIds.has(chatId));

    if (commonChatIds.length) {
      const { data: existingChats, error: existingChatsError } = await withReadRetry(
        () =>
          supabase
            .from('chats')
            .select('*')
            .in('id', commonChatIds),
        'load existing private chats'
      );

      const chat = handle<any[]>(existingChats, existingChatsError).find((item) => item.type !== 'group');
      if (chat?.id) {
        return chat.id as string;
      }
    }

    const chatInsertAttempts = [
      { type: 'private', name: null, created_by: primaryActorId },
      { type: 'private', created_by: primaryActorId },
      { name: null, created_by: primaryActorId },
      { created_by: primaryActorId },
    ];

    let chatId = '';
    let lastCreateError: unknown;
    for (const attempt of chatInsertAttempts) {
      const { data, error } = await supabase.from('chats').insert(attempt).select('id').single();
      if (!error) {
        chatId = String((data as Record<string, unknown> | null)?.id || '');
        if (chatId) break;
      }

      lastCreateError = error;
      if (!isColumnMissingError(error)) {
        throw error;
      }
    }

    if (!chatId) {
      throw lastCreateError ?? new Error('Не удалось создать чат');
    }

    const membersInsertAttempts: Array<Array<Record<string, unknown>>> = [];
    for (const actorId of actorIds) {
      if (!actorId || actorId === partnerId) {
        continue;
      }
      membersInsertAttempts.push([
        { chat_id: chatId, user_id: actorId, role: 'member' },
        { chat_id: chatId, user_id: partnerId, role: 'member' },
      ]);
      membersInsertAttempts.push([
        { chat_id: chatId, user_id: actorId },
        { chat_id: chatId, user_id: partnerId },
      ]);
    }

    let lastMembersError: unknown;
    for (const attempt of membersInsertAttempts) {
      const { error } = await supabase.from('chat_members').insert(attempt);
      if (!error) {
        return chatId;
      }

      lastMembersError = error;
      if (!isColumnMissingError(error)) {
        throw error;
      }
    }

    throw lastMembersError ?? new Error('Не удалось добавить участников в чат');
  },

  subscribe: (chatId: string, onChange: () => void) =>
    supabase
      .channel(`chat-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        () => onChange()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_read_receipts',
        },
        () => onChange()
      )
      .subscribe(),

  subscribeAllChats: (onMessage: (message: Record<string, unknown>) => void) =>
    supabase
      .channel(`all-chats-unread-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          if (payload.new) {
            onMessage(payload.new as Record<string, unknown>);
          }
        }
      )
      .subscribe(),
};

const JOB_ADDRESS_SOURCE_TABLES = ['atss_q1_2026', 'kasip_azm_q1_2026'];

const toNumericCoordinate = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getAddressLatitude = (row: Record<string, unknown>) =>
  toNumericCoordinate(
    row.lat ??
      row.latitude ??
      row.shirota ??
      row.y_coord ??
      row.y ??
      row.latitud
  );

const getAddressLongitude = (row: Record<string, unknown>) =>
  toNumericCoordinate(
    row.lng ??
      row.longitude ??
      row.dolgota ??
      row.x_coord ??
      row.x ??
      row.longitud
  );

const countTruthyFields = (row: Record<string, unknown>, keys: string[]) =>
  keys.reduce((count, key) => (row[key] ? count + 1 : count), 0);

const normalizeJobAddressRows = (table: string, rows: any[]) => {
  if (table === 'atss_q1_2026') {
    return rows
      .map((row) => {
        const typed = row as Record<string, unknown>;
        const address = (typed.adres_razmeshcheniya as string | undefined)?.trim() || '';
        if (!address) {
          return null;
        }

        const sourceId =
          String(
            typed.id_ploshadki ??
              typed.id ??
              typed.servisnyy_id ??
              `${address}-${typed.rayon || ''}`
          ) || address;

        return {
          source: 'atss',
          source_id: sourceId,
          address,
          district: String(typed.rayon || ''),
          sk_name: String(typed.naimenovanie_sk || ''),
          servisnyy_id: String(typed.servisnyy_id || ''),
          sk_count: countTruthyFields(typed, ['id_sk', 'id_sk2', 'id_sk3', 'id_sk4', 'id_sk5']) || 1,
          lat: getAddressLatitude(typed),
          lng: getAddressLongitude(typed),
          raw: typed,
        };
      })
      .filter(Boolean);
  }

  return rows
    .map((row) => {
      const typed = row as Record<string, unknown>;
      const address = (typed.adres_raspolozheniya as string | undefined)?.trim() || '';
      if (!address) {
        return null;
      }

      const sourceId =
        String(
          typed.id_ploshadki ??
            typed.id ??
            typed.servisnyy_id ??
            `${address}-${typed.ploshchadka || ''}`
        ) || address;

      return {
        source: 'kasip',
        source_id: sourceId,
        address,
        district: String(typed.ploshchadka || ''),
        sk_name: String(typed.naimenovanie_sk || ''),
        servisnyy_id: String(typed.servisnyy_id || ''),
        sk_count:
          countTruthyFields(typed, [
            'id_konditsionera1',
            'id_konditsionera2',
            'id_konditsionera3',
            'id_konditsionera4',
            'id_konditsionera5',
          ]) || 1,
        lat: getAddressLatitude(typed),
        lng: getAddressLongitude(typed),
        raw: typed,
      };
    })
    .filter(Boolean);
};

const loadJobAddresses = async () => {
  const all: any[] = [];
  for (const table of JOB_ADDRESS_SOURCE_TABLES) {
    try {
      const { data, error } = await withReadRetry(
        () =>
          supabase
            .from(table)
            .select('*')
            .limit(2500),
        `load addresses from ${table}`
      );

      const rows = handle<any[]>(data, error);
      all.push(...normalizeJobAddressRows(table, rows));
    } catch (error) {
      if (isRelationMissingError(error)) {
        continue;
      }
      throw error;
    }
  }

  const unique = new Map<string, any>();
  for (const item of all) {
    const key = `${item.source}:${item.source_id}`;
    if (!unique.has(key)) {
      unique.set(key, item);
    }
  }

  return [...unique.values()].sort((a, b) => String(a.address).localeCompare(String(b.address), 'ru'));
};

const normalizeJobList = async (jobs: any[]) => {
  const usersMap = await fetchUsersMap(jobs.map((job) => job.engineer_id));
  return jobs.map((job) => ({
    ...job,
    engineer: job.engineer_id ? usersMap[job.engineer_id] || null : null,
  }));
};

const cleanPayload = (payload: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

const insertJobRecord = async (payload: Record<string, unknown>) => {
  const attempts = [
    payload,
    cleanPayload({ ...payload, planned_duration_hours: undefined }),
    cleanPayload({
      ...payload,
      planned_duration_hours: undefined,
      district: undefined,
      sk_name: undefined,
      sk_count: undefined,
      servisnyy_id: undefined,
    }),
    cleanPayload({
      ...payload,
      planned_duration_hours: undefined,
      district: undefined,
      sk_name: undefined,
      sk_count: undefined,
      servisnyy_id: undefined,
      lat: undefined,
      lng: undefined,
    }),
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    const { data, error } = await supabase.from('jobs').insert(attempt).select('*').single();
    if (!error) {
      return data;
    }

    lastError = error;
    if (!isColumnMissingError(error)) {
      throw error;
    }
  }

  throw lastError ?? new Error('Failed to create job');
};

export const jobsApi = {
  getAddresses: async () => loadJobAddresses(),

  getAll: async (filters: { chat_id?: string; status?: string; include_done?: boolean } = {}) => {
    let query = supabase.from('jobs').select('*').order('started_at', { ascending: false }).limit(1500);

    if (filters.chat_id) {
      query = query.eq('chat_id', filters.chat_id);
    }
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters.include_done === false) {
      query = query.neq('status', 'done');
    }

    const { data, error } = await withReadRetry(() => query, 'load jobs');
    const jobs = handle<any[]>(data, error);
    return normalizeJobList(jobs);
  },

  startInChat: async (payload: {
    chat_id: string;
    address: string;
    district?: string;
    sk_name?: string;
    sk_count?: number;
    servisnyy_id?: string;
    lat?: number | null;
    lng?: number | null;
    planned_duration_hours?: number | null;
  }) => {
    const address = payload.address?.trim();
    if (!address) {
      throw new Error('Адрес обязателен');
    }

    const { user } = await getCurrentProfile();
    const nowIso = new Date().toISOString();
    const plannedDuration =
      typeof payload.planned_duration_hours === 'number' && Number.isFinite(payload.planned_duration_hours)
        ? Math.max(1, Math.round(payload.planned_duration_hours))
        : null;

    const jobPayload = cleanPayload({
      chat_id: payload.chat_id,
      address,
      district: payload.district?.trim() || null,
      sk_name: payload.sk_name?.trim() || null,
      sk_count: typeof payload.sk_count === 'number' ? payload.sk_count : null,
      servisnyy_id: payload.servisnyy_id?.trim() || null,
      lat: typeof payload.lat === 'number' ? payload.lat : null,
      lng: typeof payload.lng === 'number' ? payload.lng : null,
      engineer_id: user.id,
      status: 'active',
      started_at: nowIso,
      planned_duration_hours: plannedDuration,
    });

    const created = await insertJobRecord(jobPayload);
    const createdJobId = String((created as Record<string, unknown> | null)?.id || '');

    await insertChatMessage({
      chat_id: payload.chat_id,
      userId: user.id,
      content: { text: `📍 Начал работу по адресу: ${address}` },
      messageType: 'job',
      jobId: createdJobId || null,
    });

    return created;
  },

  confirm: async (jobId: string) => {
    const { user } = await getCurrentProfile();
    const { data, error } = await supabase
      .from('jobs')
      .update({ confirmed_by: user.id })
      .eq('id', jobId)
      .select('*')
      .single();

    return handle<any>(data, error);
  },

  finish: async (jobId: string) => {
    const { data, error } = await supabase
      .from('jobs')
      .update({ status: 'done', finished_at: new Date().toISOString() })
      .eq('id', jobId)
      .select('*')
      .single();

    return handle<any>(data, error);
  },

  remove: async (jobId: string) => {
    const cleanupMessages = await supabase.from('messages').delete().eq('job_id', jobId);
    if (cleanupMessages.error && !isColumnMissingError(cleanupMessages.error)) {
      console.warn('Failed to delete messages for job:', cleanupMessages.error);
    }

    const { error } = await supabase.from('jobs').delete().eq('id', jobId);
    if (error) {
      throw error;
    }
  },

  subscribeAll: (onChange: (payload: Record<string, unknown>) => void) =>
    supabase
      .channel(`jobs-all-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
        },
        (payload) => onChange(payload as Record<string, unknown>)
      )
      .subscribe(),

  subscribeChat: (chatId: string, onChange: () => void) =>
    supabase
      .channel(`jobs-chat-${chatId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `chat_id=eq.${chatId}`,
        },
        () => onChange()
      )
      .subscribe(),
};

const normalizeAvrTask = (task: any, projectsMap: Record<string, any>, usersMap: Record<string, any>) => {
  const executorId = task.executor_id || task.assignee_id || null;
  const project = task.project_id ? projectsMap[task.project_id] || null : null;
  const executor = executorId ? usersMap[executorId] || null : null;
  const creator = task.created_by ? usersMap[task.created_by] || null : null;

  return {
    ...task,
    project,
    projects: project,
    executor,
    assignee: executor,
    users: executor,
    creator,
  };
};

const AVR_ACTIVE_STATUSES = ['completed', 'cancelled'];

export const avrApi = {
  getAll: async (filters: { executor_id?: string; include_completed?: boolean } = {}) => {
    const { data, error } = await withReadRetry(() => {
      let query = supabase.from('tasks_avr').select('*').order('created_at', { ascending: false });

      if (filters.executor_id) {
        query = query.eq('executor_id', filters.executor_id);
      }

      if (!filters.include_completed) {
        query = query.not('status', 'in', `(${AVR_ACTIVE_STATUSES.join(',')})`);
      }

      return query;
    }, 'load avr tasks');

    const tasks = handle<any[]>(data, error);
    const projectsMap = await fetchProjectsMap(tasks.map((task) => task.project_id));
    const usersMap = await fetchUsersMap(
      tasks.flatMap((task) => [task.executor_id, task.assignee_id, task.created_by])
    );

    return tasks.map((task) => normalizeAvrTask(task, projectsMap, usersMap));
  },

  getById: async (id: string) => {
    const { data, error } = await withReadRetry(
      () =>
        supabase
          .from('tasks_avr')
          .select('*')
          .eq('id', id)
          .single(),
      'load avr task'
    );

    const task = handle<any>(data, error);
    const [projectsMap, usersMap] = await Promise.all([
      fetchProjectsMap([task.project_id]),
      fetchUsersMap([task.executor_id, task.assignee_id, task.created_by]),
    ]);

    const normalizedTask = normalizeAvrTask(task, projectsMap, usersMap);
    const { data: purchaseRequests, error: purchaseRequestsError } = await withReadRetry(
      () =>
        supabase
          .from('purchase_requests')
          .select('*')
          .eq('task_avr_id', id)
          .order('created_at', { ascending: false }),
      'load avr purchase requests'
    ).catch((reason) => {
      if (isColumnMissingError(reason)) {
        return { data: [], error: null };
      }
      throw reason;
    });

    if (purchaseRequestsError) {
      throw purchaseRequestsError;
    }

    const purchaseUsersMap = await fetchUsersMap(
      (purchaseRequests || []).flatMap((request: any) => [request.created_by, request.approved_by])
    );

    return {
      ...normalizedTask,
      purchase_requests: (purchaseRequests || []).map((request: any) => ({
        ...request,
        creator: request.created_by ? purchaseUsersMap[request.created_by] || null : null,
        approved_by_user: request.approved_by ? purchaseUsersMap[request.approved_by] || null : null,
      })),
    };
  },

  create: async (payload: {
    title: string;
    type?: string;
    description?: string | null;
    address_text?: string | null;
    date_from?: string | null;
    date_to?: string | null;
    project_id?: string | null;
    executor_id?: string | null;
  }) => {
    const title = payload.title?.trim();
    if (!title) {
      throw new Error('Название заявки обязательно');
    }

    const { user } = await getCurrentProfile();
    const nowIso = new Date().toISOString();
    const assignee = payload.executor_id || user.id;

    const cleanPayload = (value: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

    const basePayload = cleanPayload({
      title,
      type: payload.type || 'AVR',
      description: payload.description?.trim() || null,
      address_text: payload.address_text?.trim() || null,
      date_from: payload.date_from || null,
      date_to: payload.date_to || null,
      project_id: payload.project_id || null,
      executor_id: assignee,
      assignee_id: assignee,
      status: 'new',
      created_by: user.id,
      updated_at: nowIso,
    });

    const attempts = [
      basePayload,
      cleanPayload({ ...basePayload, assignee_id: undefined }),
      cleanPayload({ ...basePayload, executor_id: undefined }),
      cleanPayload({ ...basePayload, assignee_id: undefined, executor_id: undefined }),
      cleanPayload({ ...basePayload, updated_at: undefined }),
      cleanPayload({ ...basePayload, created_by: undefined }),
    ];

    let lastError: unknown;
    for (const attempt of attempts) {
      const { data, error } = await supabase.from('tasks_avr').insert(attempt).select().single();
      if (!error) {
        return data;
      }

      lastError = error;
      if (!isColumnMissingError(error)) {
        throw error;
      }
    }

    throw lastError ?? new Error('Не удалось создать заявку АВР');
  },

  updateStatus: async (id: string, status: string) => {
    const { user } = await getCurrentProfile();
    const payload = {
      status,
      updated_at: new Date().toISOString(),
      status_changed_by: user.id,
      status_changed_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('tasks_avr')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    return handle(data, error);
  },
};

const toMonthRange = (year: number, monthZeroBased: number) => {
  const start = new Date(year, monthZeroBased, 1, 0, 0, 0, 0);
  const end = new Date(year, monthZeroBased + 1, 0, 23, 59, 59, 999);
  const day = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
      value.getDate()
    ).padStart(2, '0')}`;

  return {
    startDate: day(start),
    endDate: day(end),
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

export const calendarApi = {
  getMonthData: async (
    year: number,
    monthZeroBased: number,
    filters: { assignee_id?: string; executor_id?: string } = {}
  ) => {
    const { start, end } = toMonthRange(year, monthZeroBased);

    let tasksQuery = supabase
      .from('tasks')
      .select('id, title, status, due_date, assignee_id')
      .gte('due_date', start)
      .lte('due_date', end);
    let installationsQuery = supabase
      .from('installations')
      .select('id, title, status, scheduled_at, assignee_id, address')
      .gte('scheduled_at', start)
      .lte('scheduled_at', end);
    let avrQuery = supabase
      .from('tasks_avr')
      .select('id, title, status, type, date_from, date_to, executor_id')
      .lte('date_from', end)
      .gte('date_to', start);

    if (filters.assignee_id) {
      tasksQuery = tasksQuery.eq('assignee_id', filters.assignee_id);
      installationsQuery = installationsQuery.eq('assignee_id', filters.assignee_id);
    }
    if (filters.executor_id) {
      avrQuery = avrQuery.eq('executor_id', filters.executor_id);
    }

    const [tasksResult, installationsResult, avrResult] = await Promise.all([
      withReadRetry(() => tasksQuery, 'load month tasks'),
      withReadRetry(() => installationsQuery, 'load month installations'),
      withReadRetry(() => avrQuery, 'load month avr'),
    ]);

    return {
      tasks: handle<any[]>(tasksResult.data, tasksResult.error),
      installations: handle<any[]>(installationsResult.data, installationsResult.error),
      avr: handle<any[]>(avrResult.data, avrResult.error),
    };
  },
};

const normalizeEquipmentPower = (item: any) => {
  const effectivePower =
    typeof item.effective_power_watts === 'number'
      ? item.effective_power_watts
      : typeof item.power_watts === 'number'
        ? item.power_watts
        : null;

  return {
    ...item,
    effective_power_watts: effectivePower,
    power_source:
      item.power_source ||
      (item.effective_power_watts != null || item.power_watts != null ? 'sats' : null),
  };
};

const loadSiteEquipment = async (siteId: string) => {
  const fromPowerView = await withReadRetry(
    () =>
      supabase
        .from('site_equipment_with_power')
        .select('*')
        .eq('site_id', siteId)
        .order('device_category'),
    'load site equipment (with power view)'
  ).catch((reason) => {
    if (isRelationMissingError(reason)) {
      return { data: null, error: reason };
    }
    throw reason;
  });

  if (fromPowerView.data) {
    return handle<any[]>(fromPowerView.data, null).map(normalizeEquipmentPower);
  }

  const fromCache = await withReadRetry(
    () =>
      supabase
        .from('site_equipment_cache')
        .select('*')
        .eq('site_id', siteId)
        .order('device_category'),
    'load site equipment (cache)'
  );

  return handle<any[]>(fromCache.data, fromCache.error).map(normalizeEquipmentPower);
};

const loadSiteHeatSummary = async (siteId: string, equipment: any[]) => {
  const fromView = await withReadRetry(
    () =>
      supabase
        .from('site_heat_summary')
        .select('*')
        .eq('site_id', siteId)
        .single(),
    'load site heat summary'
  ).catch((reason) => {
    if (isRelationMissingError(reason) || (reason as any)?.code === 'PGRST116') {
      return { data: null, error: null };
    }
    throw reason;
  });

  if (fromView.data) {
    return fromView.data;
  }

  const totalPower = equipment.reduce((sum, item) => {
    return sum + (typeof item.effective_power_watts === 'number' ? item.effective_power_watts : 0);
  }, 0);

  return {
    site_id: siteId,
    total_power_watts: Math.round(totalPower),
    heat_kw: Number((totalPower / 1000).toFixed(2)),
    heat_kcal_per_hour: Number((totalPower * 0.859845).toFixed(2)),
  };
};

const SITES_SYNC_SECRET = 'korneo_sync_2026';

const getSessionAccessToken = async () => {
  const sessionResponse = await withTimeout(supabase.auth.getSession(), 'restore session for edge call', 6000);
  const sessionError = (sessionResponse as any)?.error;
  if (sessionError) {
    throw new Error(sessionError.message || 'Failed to restore session');
  }

  const token = (sessionResponse as any)?.data?.session?.access_token;
  if (!token) {
    throw new Error('Authorization is required');
  }

  return token as string;
};

const parseEdgePayload = async (response: Response): Promise<Record<string, any>> => {
  const raw = await response.text();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : { raw: parsed };
  } catch {
    return { raw };
  }
};

const callEdgeFunction = async (
  name: string,
  method: 'POST' | 'PATCH',
  payload: Record<string, unknown>
) => {
  const token = await getSessionAccessToken();
  const response = await withTimeout(
    fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(name === 'sync-sites' ? { 'x-sync-secret': SITES_SYNC_SECRET } : {}),
      },
      body: JSON.stringify(payload),
    }),
    `${name} edge call`,
    90000
  );

  const parsed = await parseEdgePayload(response);
  if (!response.ok) {
    throw new Error(
      parsed.error ||
        parsed.message ||
        (typeof parsed.raw === 'string' ? parsed.raw : '') ||
        `${name} failed with status ${response.status}`
    );
  }

  return parsed;
};

export const sitesApi = {
  getAll: async () => {
    const { data, error } = await withReadRetry(
      () =>
        supabase
          .from('sites_cache')
          .select('id, emts_id, emts_code, name, address, type, segment, status, district, synced_at')
          .order('address', { ascending: true }),
      'load sites list'
    );

    return handle<any[]>(data, error);
  },

  getById: async (id: string) => {
    const { data: site, error: siteError } = await withReadRetry(
      () =>
        supabase
          .from('sites_cache')
          .select('*')
          .eq('id', id)
          .single(),
      'load site'
    );

    const normalizedSite = handle<any>(site, siteError);
    const equipment = await loadSiteEquipment(id);
    const heat = await loadSiteHeatSummary(id, equipment);

    return {
      site: normalizedSite,
      equipment,
      heat,
    };
  },

  syncNow: async () => {
    return callEdgeFunction('sync-sites', 'POST', {});
  },

  setManualPower: async (model: string, powerWatts: number) => {
    const normalizedModel = model.trim();
    if (!normalizedModel) {
      throw new Error('Model is required');
    }
    if (!Number.isFinite(powerWatts) || powerWatts <= 0) {
      throw new Error('Power must be greater than 0');
    }

    return callEdgeFunction('lookup-power', 'PATCH', {
      model: normalizedModel,
      power_watts: powerWatts,
    });
  },
};

const ATSS_TABLES = ['atss_q1_2026', 'atss'];
const ATSS_BATCH_SIZE = 50;

const loadAtssFromTable = async (table: string) => {
  const orderedResult = await withReadRetry(
    () =>
      supabase
        .from(table)
        .select('*')
        .order('planovaya_data_1_kv_2026', { ascending: true, nullsFirst: false })
        .limit(2000),
    `load atss from ${table}`
  ).catch(async (reason) => {
    if (!isColumnMissingError(reason)) {
      throw reason;
    }

    return withReadRetry(
      () =>
        supabase
          .from(table)
          .select('*')
          .limit(2000),
      `load atss from ${table} (fallback)`
    );
  });

  return handle<any[]>(orderedResult.data, orderedResult.error);
};

const upsertAtssBatch = async (
  batch: Record<string, unknown>[],
  preferredTable?: string | null
) => {
  const tables = preferredTable
    ? [preferredTable, ...ATSS_TABLES.filter((table) => table !== preferredTable)]
    : [...ATSS_TABLES];

  let relationError: unknown;
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: 'id_ploshadki', ignoreDuplicates: false });

    if (!error) {
      return table;
    }

    if (isRelationMissingError(error)) {
      relationError = error;
      continue;
    }

    throw error;
  }

  throw relationError ?? new Error('ATSS table is not available');
};

export const atssApi = {
  getAll: async () => {
    let lastError: unknown;
    for (const table of ATSS_TABLES) {
      try {
        return await loadAtssFromTable(table);
      } catch (error) {
        lastError = error;
        if (!isRelationMissingError(error)) {
          throw error;
        }
      }
    }

    if (lastError) {
      throw lastError;
    }
    return [];
  },

  upsertBatches: async (
    records: Record<string, unknown>[],
    options: {
      batchSize?: number;
      onProgress?: (done: number, total: number, errorsCount: number) => void;
    } = {}
  ) => {
    const total = records.length;
    const batchSize = Math.max(1, options.batchSize ?? ATSS_BATCH_SIZE);
    let preferredTable: string | null = ATSS_TABLES[0];
    let done = 0;
    const errors: Array<{ from: number; to: number; message: string }> = [];

    for (let index = 0; index < total; index += batchSize) {
      const batch = records.slice(index, index + batchSize);
      try {
        preferredTable = await upsertAtssBatch(batch, preferredTable);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown ATSS upload error';
        errors.push({
          from: index + 1,
          to: index + batch.length,
          message,
        });
      }

      done += batch.length;
      options.onProgress?.(done, total, errors.length);
    }

    return {
      done,
      total,
      errors,
      table: preferredTable,
    };
  },
};
