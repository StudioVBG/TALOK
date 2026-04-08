import { apiClient } from "@/lib/api-client";
import type { ColocationTaskRow } from "@/lib/supabase/database.types";

export class ColocationTasksService {
  async getTasks(propertyId: string): Promise<ColocationTaskRow[]> {
    const response = await apiClient.get<{ tasks: ColocationTaskRow[] }>(
      `/colocation/tasks?property_id=${propertyId}`
    );
    return response.tasks;
  }

  async createTask(data: {
    property_id: string;
    title: string;
    description?: string;
    recurrence?: string;
    assigned_member_id?: string;
    assigned_room_id?: string;
    due_date?: string;
    rotation_enabled?: boolean;
    sort_order?: number;
  }): Promise<ColocationTaskRow> {
    const response = await apiClient.post<{ task: ColocationTaskRow }>(
      "/colocation/tasks",
      data
    );
    return response.task;
  }

  async updateTask(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      recurrence: string;
      assigned_member_id: string;
      due_date: string;
      rotation_enabled: boolean;
      sort_order: number;
    }>
  ): Promise<ColocationTaskRow> {
    const response = await apiClient.patch<{ task: ColocationTaskRow }>(
      `/colocation/tasks/${id}`,
      data
    );
    return response.task;
  }

  async completeTask(id: string): Promise<ColocationTaskRow> {
    const response = await apiClient.post<{ task: ColocationTaskRow }>(
      `/colocation/tasks/${id}`,
      { action: "complete" }
    );
    return response.task;
  }

  async rotateTasks(propertyId: string): Promise<{ rotated: number }> {
    const response = await apiClient.post<{ rotated: number }>(
      "/colocation/tasks/rotate",
      { property_id: propertyId }
    );
    return response;
  }
}

export const colocationTasksService = new ColocationTasksService();
