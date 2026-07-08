import { db } from '../lib/firebase';
import {
  collection,
  getDocs,
  writeBatch,
  doc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';

export interface WipeProgress {
  phase: string;
  detail: string;
  usersProcessed: number;
  totalUsers: number;
}

/**
 * Wipe completo do banco de usuários.
 * Deleta:
 *   - users/{uid}/characters/{charId}/intel/*
 *   - users/{uid}/characters/{charId}/achievements/*
 *   - users/{uid}/characters/{charId}/stats/*
 *   - users/{uid}/characters/{charId}
 *   - users/{uid}
 *   - playEvents/*
 *   - activityLog/*
 *   - groups/{groupId}/messages/*
 *   - groups/{groupId}
 */
export async function wipeAllUserData(
  onProgress?: (progress: WipeProgress) => void
): Promise<{ success: boolean; usersDeleted: number; errors: string[] }> {
  const errors: string[] = [];
  let usersDeleted = 0;

  const report = (phase: string, detail: string) => {
    if (onProgress) {
      onProgress({ phase, detail, usersProcessed: usersDeleted, totalUsers: 0 });
    }
    console.log(`[WIPE] [${phase}] ${detail}`);
  };

  try {
    // =========================================
    // PHASE 1: Enumerate users
    // =========================================
    report('ENUMERAÇÃO', 'Listando todos os usuários...');
    const usersSnap = await getDocs(collection(db, 'users'));
    const totalUsers = usersSnap.size;
    report('ENUMERAÇÃO', `${totalUsers} usuários encontrados.`);

    // =========================================
    // PHASE 2: Delete each user and subcollections
    // =========================================
    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const userEmail = userDoc.data().email || uid.slice(0, 8);

      try {
        report('USUÁRIOS', `[${usersDeleted + 1}/${totalUsers}] Processando ${userEmail}...`);

        // 2a. Get all characters
        const charsSnap = await getDocs(collection(db, 'users', uid, 'characters'));

        for (const charDoc of charsSnap.docs) {
          const charId = charDoc.id;

          // Delete all known subcollections under each character
          const subCollections = ['intel', 'achievements'];
          for (const subName of subCollections) {
            await deleteSubcollection(`users/${uid}/characters/${charId}/${subName}`);
          }

          // Delete stats/main document
          try {
            await deleteDoc(doc(db, 'users', uid, 'characters', charId, 'stats', 'main'));
          } catch { /* may not exist */ }

          // Delete the character document itself
          await deleteDoc(doc(db, 'users', uid, 'characters', charId));
        }

        // Delete root stats/main (contas antigas sem personagem)
        try {
          await deleteDoc(doc(db, 'users', uid, 'stats', 'main'));
        } catch { /* may not exist */ }

        // 2c. Delete the user document itself
        await deleteDoc(doc(db, 'users', uid));
        usersDeleted++;

        if (onProgress) {
          onProgress({ phase: 'USUÁRIOS', detail: `${userEmail} apagado.`, usersProcessed: usersDeleted, totalUsers });
        }
      } catch (err: any) {
        const msg = `Erro ao deletar user ${uid}: ${err.message}`;
        console.error(`[WIPE] ${msg}`);
        errors.push(msg);
      }
    }

    // =========================================
    // PHASE 3: Delete playEvents
    // =========================================
    report('PLAY_EVENTS', 'Apagando eventos de reprodução...');
    const eventsDeleted = await deleteSubcollection('playEvents');
    report('PLAY_EVENTS', `${eventsDeleted} playEvents deletados.`);

    // =========================================
    // PHASE 4: Delete activityLog
    // =========================================
    report('ACTIVITY_LOG', 'Apagando logs de telemetria...');
    const logsDeleted = await deleteSubcollection('activityLog');
    report('ACTIVITY_LOG', `${logsDeleted} logs deletados.`);

    // =========================================
    // PHASE 5: Delete groups and their messages
    // =========================================
    report('GROUPS', 'Apagando grupos e mensagens...');
    const groupsSnap = await getDocs(collection(db, 'groups'));
    let groupsDeleted = 0;
    for (const groupDoc of groupsSnap.docs) {
      await deleteSubcollection(`groups/${groupDoc.id}/messages`);
      await deleteDoc(groupDoc.ref);
      groupsDeleted++;
    }
    report('GROUPS', `${groupsDeleted} grupos deletados.`);

    // =========================================
    // DONE
    // =========================================
    report('CONCLUÍDO', `Wipe finalizado! ${usersDeleted} usuários removidos.`);
    return { success: true, usersDeleted, errors };

  } catch (err: any) {
    const msg = `Erro fatal no wipe: ${err.message}`;
    console.error(`[WIPE] ${msg}`);
    errors.push(msg);
    return { success: false, usersDeleted, errors };
  }
}

/**
 * Helper: deletes all documents in a collection path using batched writes.
 * Returns the count of documents deleted.
 */
async function deleteSubcollection(path: string): Promise<number> {
  const pathSegments = path.split('/');
  const colRef = collection(db, pathSegments[0], ...pathSegments.slice(1));
  const snap = await getDocs(colRef);

  if (snap.empty) return 0;

  let count = 0;
  let batch = writeBatch(db);

  for (const docSnap of snap.docs) {
    batch.delete(docSnap.ref);
    count++;

    // Firestore batch limit is 500, we flush at 400 for safety
    if (count % 400 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }

  // Commit remaining
  if (count % 400 !== 0) {
    await batch.commit();
  }

  return count;
}
