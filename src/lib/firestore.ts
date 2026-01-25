import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Project, UserStory } from '../store/useStoryStore';

// Collection references
const projectsCollection = collection(db, 'projects');
const diagramsCollection = collection(db, 'diagrams');

// ============ Projects ============

export async function fetchProjects(): Promise<Project[]> {
  const snapshot = await getDocs(projectsCollection);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Project[];
}

export async function createProject(project: Project): Promise<void> {
  await setDoc(doc(projectsCollection, project.id), {
    name: project.name,
    description: project.description,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  });
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, 'name' | 'description'>>
): Promise<void> {
  await updateDoc(doc(projectsCollection, id), {
    ...updates,
    updatedAt: Date.now(),
  });
}

export async function deleteProject(id: string): Promise<void> {
  // Delete all diagrams in this project first
  const diagramsQuery = query(diagramsCollection, where('projectId', '==', id));
  const snapshot = await getDocs(diagramsQuery);
  const deletePromises = snapshot.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletePromises);

  // Delete the project
  await deleteDoc(doc(projectsCollection, id));
}

// ============ Diagrams ============

export async function fetchDiagrams(): Promise<UserStory[]> {
  const snapshot = await getDocs(diagramsCollection);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as UserStory[];
}

export async function fetchDiagramsByProject(projectId: string): Promise<UserStory[]> {
  const q = query(diagramsCollection, where('projectId', '==', projectId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as UserStory[];
}

export async function fetchDiagram(id: string): Promise<UserStory | null> {
  const docRef = doc(diagramsCollection, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as UserStory;
}

export async function createDiagram(diagram: UserStory): Promise<void> {
  await setDoc(doc(diagramsCollection, diagram.id), {
    projectId: diagram.projectId,
    name: diagram.name,
    description: diagram.description,
    type: diagram.type,
    createdAt: diagram.createdAt,
    updatedAt: diagram.updatedAt,
    nodes: diagram.nodes,
    edges: diagram.edges,
    actors: diagram.actors,
    messages: diagram.messages,
  });
}

export async function updateDiagram(
  id: string,
  updates: Partial<UserStory>
): Promise<void> {
  const { id: _, ...updateData } = updates;
  await updateDoc(doc(diagramsCollection, id), {
    ...updateData,
    updatedAt: Date.now(),
  });
}

export async function deleteDiagram(id: string): Promise<void> {
  await deleteDoc(doc(diagramsCollection, id));
}

// ============ Real-time Listeners ============

export function subscribeToProjects(
  callback: (projects: Project[]) => void
): Unsubscribe {
  return onSnapshot(projectsCollection, (snapshot) => {
    const projects = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Project[];
    callback(projects);
  });
}

export function subscribeToDiagrams(
  callback: (diagrams: UserStory[]) => void
): Unsubscribe {
  return onSnapshot(diagramsCollection, (snapshot) => {
    const diagrams = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as UserStory[];
    callback(diagrams);
  });
}
