export interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  status: {
    status: string;
    color: string;
  };
  priority?: {
    priority: string;
    color: string;
  };
  due_date?: string;
  start_date?: string;
  assignees?: Array<{
    id: number;
    username: string;
    email: string;
  }>;
  list: {
    id: string;
    name: string;
  };
  space: {
    id: string;
    name: string;
  };
}

export interface ClickUpList {
  id: string;
  name: string;
  content: string;
  space: {
    id: string;
    name: string;
  };
  status: {
    status: string;
    color: string;
  };
}

export interface ClickUpSpace {
  id: string;
  name: string;
  private: boolean;
  statuses: Array<{
    id: string;
    status: string;
    color: string;
  }>;
}

export interface CreateTaskData {
  name: string;
  description?: string;
  priority?: number;
  due_date?: number;
  start_date?: number;
  assignees?: number[];
  status?: string;
}

export interface CreateSubtaskData {
  parentTaskId: string;
  name: string;
  description?: string;
  priority?: number;
  due_date?: number;
  start_date?: number;
  assignees?: number[];
  status?: string;
}

export interface BulkCreateTasksData {
  tasks: Array<CreateTaskData>;
}

export interface CreateListData {
  name: string;
  content?: string;
  due_date?: number;
  priority?: number;
  assignee?: number;
  status?: string;
}

export interface UpdateTaskData extends Partial<CreateTaskData> {}

export interface ClickUpFolder {
  id: string;
  name: string;
  orderindex: number;
  override_statuses: boolean;
  hidden: boolean;
  space: {
    id: string;
    name: string;
  };
  lists: ClickUpList[];
}

export interface CreateFolderData {
  name: string;
  override_statuses?: boolean;
}
