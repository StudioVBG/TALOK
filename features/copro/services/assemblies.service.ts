// =====================================================
// Service: Assemblées Générales COPRO
// =====================================================

import { createClient } from '@/lib/supabase/client';
import type {
  Assembly,
  AssemblySummary,
  Motion,
  MotionWithResults,
  AssemblyAttendance,
  Proxy,
  Vote,
  AssemblyDocument,
  QuorumResult,
  MotionResult,
  CreateAssemblyInput,
  UpdateAssemblyInput,
  CreateMotionInput,
  CreateProxyInput,
  CreateAttendanceInput,
  CastVoteInput,
} from '@/lib/types/copro-assemblies';

// =====================================================
// ASSEMBLIES
// =====================================================

export async function getAssembliesBySite(
  siteId: string,
  status?: string
): Promise<AssemblySummary[]> {
  const supabase = createClient();
  
  let query = supabase
    .from('v_assemblies_summary')
    .select('*')
    .eq('site_id', siteId)
    .order('scheduled_at', { ascending: false });
  
  if (status) {
    query = query.eq('status', status);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data || [];
}

export async function getUpcomingAssemblies(
  siteId?: string
): Promise<AssemblySummary[]> {
  const supabase = createClient();
  
  let query = supabase
    .from('v_assemblies_summary')
    .select('*')
    .in('status', ['draft', 'convoked'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at');
  
  if (siteId) {
    query = query.eq('site_id', siteId);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data || [];
}

export async function getAssemblyById(id: string): Promise<Assembly | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('assemblies')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  return data;
}

export async function createAssembly(input: CreateAssemblyInput): Promise<Assembly> {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  // Générer le numéro d'AG
  const year = new Date(input.scheduled_at).getFullYear();
  const { data: existingCount } = await supabase
    .from('assemblies')
    .select('id', { count: 'exact' })
    .eq('site_id', input.site_id)
    .gte('scheduled_at', `${year}-01-01`)
    .lte('scheduled_at', `${year}-12-31`);
  
  const sequence = (existingCount?.length || 0) + 1;
  const assemblyNumber = `${input.assembly_type}-${year}-${sequence.toString().padStart(2, '0')}`;
  
  // Récupérer le total des tantièmes du site
  const { data: site } = await supabase
    .from('sites')
    .select('total_tantiemes_general')
    .eq('id', input.site_id)
    .single();
  
  const { data, error } = await supabase
    .from('assemblies')
    .insert({
      ...input,
      assembly_number: assemblyNumber,
      total_tantiemes: site?.total_tantiemes_general || 0,
      created_by: user?.id,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateAssembly(input: UpdateAssemblyInput): Promise<Assembly> {
  const supabase = createClient();
  
  const { id, ...updateData } = input;
  
  const { data, error } = await supabase
    .from('assemblies')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function startAssembly(id: string): Promise<Assembly> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('assemblies')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function closeAssembly(id: string): Promise<Assembly> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('assemblies')
    .update({
      status: 'closed',
      ended_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function cancelAssembly(id: string): Promise<void> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('assemblies')
    .update({ status: 'cancelled' })
    .eq('id', id);
  
  if (error) throw error;
}

// =====================================================
// QUORUM
// =====================================================

export async function calculateQuorum(assemblyId: string): Promise<QuorumResult> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .rpc('calculate_assembly_quorum', { p_assembly_id: assemblyId });
  
  if (error) throw error;
  
  if (data && data.length > 0) {
    return data[0] as QuorumResult;
  }
  
  throw new Error('Impossible de calculer le quorum');
}

// =====================================================
// MOTIONS
// =====================================================

export async function getMotionsByAssembly(
  assemblyId: string
): Promise<MotionWithResults[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('v_motions_with_results')
    .select('*')
    .eq('assembly_id', assemblyId)
    .order('motion_number');
  
  if (error) throw error;
  return data || [];
}

export async function getMotionById(id: string): Promise<Motion | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('motions')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  return data;
}

export async function createMotion(input: CreateMotionInput): Promise<Motion> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('motions')
    .insert({
      ...input,
      display_order: input.motion_number,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function createMotionsBatch(
  motions: CreateMotionInput[]
): Promise<Motion[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('motions')
    .insert(motions.map(m => ({ ...m, display_order: m.motion_number })))
    .select();
  
  if (error) throw error;
  return data || [];
}

export async function updateMotion(
  id: string, 
  data: Partial<CreateMotionInput>
): Promise<Motion> {
  const supabase = createClient();
  
  const { data: motion, error } = await supabase
    .from('motions')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return motion;
}

export async function startVoting(motionId: string): Promise<Motion> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('motions')
    .update({ status: 'voting' })
    .eq('id', motionId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function endVoting(motionId: string): Promise<MotionResult> {
  const supabase = createClient();
  
  // Calculer les résultats
  const { data, error } = await supabase
    .rpc('calculate_motion_result', { p_motion_id: motionId });
  
  if (error) throw error;
  
  if (data && data.length > 0) {
    return data[0] as MotionResult;
  }
  
  throw new Error('Impossible de calculer le résultat');
}

export async function withdrawMotion(id: string): Promise<void> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('motions')
    .update({ status: 'withdrawn' })
    .eq('id', id);
  
  if (error) throw error;
}

export async function deferMotion(id: string): Promise<void> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('motions')
    .update({ status: 'deferred' })
    .eq('id', id);
  
  if (error) throw error;
}

// =====================================================
// ATTENDANCE
// =====================================================

export async function getAttendanceByAssembly(
  assemblyId: string
): Promise<AssemblyAttendance[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('assembly_attendance')
    .select('*')
    .eq('assembly_id', assemblyId)
    .order('owner_name');
  
  if (error) throw error;
  return data || [];
}

export async function createAttendance(
  input: CreateAttendanceInput
): Promise<AssemblyAttendance> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('assembly_attendance')
    .insert({
      ...input,
      arrived_at: input.attendance_type === 'present' ? new Date().toISOString() : null,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateAttendance(
  id: string,
  data: Partial<CreateAttendanceInput>
): Promise<AssemblyAttendance> {
  const supabase = createClient();
  
  const { data: attendance, error } = await supabase
    .from('assembly_attendance')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return attendance;
}

export async function signAttendance(
  id: string,
  signatureType: 'physical' | 'electronic' = 'physical'
): Promise<AssemblyAttendance> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('assembly_attendance')
    .update({
      signed_at: new Date().toISOString(),
      signature_type: signatureType,
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function markLeftEarly(id: string): Promise<AssemblyAttendance> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('assembly_attendance')
    .update({
      left_at: new Date().toISOString(),
      left_early: true,
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// =====================================================
// PROXIES
// =====================================================

export async function getProxiesByAssembly(assemblyId: string): Promise<Proxy[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('proxies')
    .select('*')
    .eq('assembly_id', assemblyId)
    .order('grantor_name');
  
  if (error) throw error;
  return data || [];
}

export async function createProxy(input: CreateProxyInput): Promise<Proxy> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('proxies')
    .insert(input)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function validateProxy(id: string): Promise<Proxy> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('proxies')
    .update({ status: 'validated' })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function cancelProxy(id: string): Promise<void> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('proxies')
    .update({ status: 'cancelled' })
    .eq('id', id);
  
  if (error) throw error;
}

// =====================================================
// VOTES
// =====================================================

export async function getVotesByMotion(motionId: string): Promise<Vote[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('votes')
    .select('*')
    .eq('motion_id', motionId)
    .order('voted_at');
  
  if (error) throw error;
  return data || [];
}

export async function castVote(input: CastVoteInput): Promise<Vote> {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('votes')
    .insert({
      ...input,
      voter_profile_id: user?.id,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function castVotesBatch(votes: CastVoteInput[]): Promise<Vote[]> {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('votes')
    .insert(votes.map(v => ({ ...v, voter_profile_id: user?.id })))
    .select();
  
  if (error) throw error;
  return data || [];
}

// =====================================================
// DOCUMENTS
// =====================================================

export async function getDocumentsByAssembly(
  assemblyId: string
): Promise<AssemblyDocument[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('assembly_documents')
    .select('*')
    .eq('assembly_id', assemblyId)
    .order('display_order');
  
  if (error) throw error;
  return data || [];
}

export async function uploadDocument(
  assemblyId: string,
  file: File,
  documentType: string,
  label: string,
  isPublic: boolean = false
): Promise<AssemblyDocument> {
  const supabase = createClient();
  
  // Upload le fichier
  const fileName = `${assemblyId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('assembly-documents')
    .upload(fileName, file);
  
  if (uploadError) throw uploadError;
  
  // Créer l'entrée dans la base
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('assembly_documents')
    .insert({
      assembly_id: assemblyId,
      document_type: documentType,
      label,
      file_path: fileName,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      is_public: isPublic,
      uploaded_by: user?.id,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  const supabase = createClient();
  
  // Récupérer le document pour avoir le chemin
  const { data: doc } = await supabase
    .from('assembly_documents')
    .select('file_path')
    .eq('id', id)
    .single();
  
  if (doc?.file_path) {
    await supabase.storage.from('assembly-documents').remove([doc.file_path]);
  }
  
  const { error } = await supabase
    .from('assembly_documents')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// =====================================================
// EXPORT
// =====================================================

export const assembliesService = {
  // Assemblies
  getAssembliesBySite,
  getUpcomingAssemblies,
  getAssemblyById,
  createAssembly,
  updateAssembly,
  startAssembly,
  closeAssembly,
  cancelAssembly,
  
  // Quorum
  calculateQuorum,
  
  // Motions
  getMotionsByAssembly,
  getMotionById,
  createMotion,
  createMotionsBatch,
  updateMotion,
  startVoting,
  endVoting,
  withdrawMotion,
  deferMotion,
  
  // Attendance
  getAttendanceByAssembly,
  createAttendance,
  updateAttendance,
  signAttendance,
  markLeftEarly,
  
  // Proxies
  getProxiesByAssembly,
  createProxy,
  validateProxy,
  cancelProxy,
  
  // Votes
  getVotesByMotion,
  castVote,
  castVotesBatch,
  
  // Documents
  getDocumentsByAssembly,
  uploadDocument,
  deleteDocument,
};

export default assembliesService;

