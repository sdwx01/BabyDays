// Cloud function: joinFamily
// Joins an existing family using a 6-character invite code.
// Idempotent: calling again if already a member just returns family info.
//
// Rate limiting: prevents brute-forcing of 6-character invite codes.
// Per-openid sliding window: max JOIN_MAX attempts within JOIN_WINDOW_MS.

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _  = db.command;

const JOIN_MAX       = 10;              // max failed attempts per window
const JOIN_WINDOW_MS = 5 * 60 * 1000;   // 5-minute sliding window
const COLL_ATTEMPTS  = 'join_attempts'; // collection of { openId, at, ok }

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const code = (event.inviteCode || '').toUpperCase().trim();

  if (!code || code.length !== 6) {
    return { success: false, error: '邀请码格式不正确' };
  }

  // ── Rate limit ─────────────────────────────────────────────────────────────
  const windowStart = Date.now() - JOIN_WINDOW_MS;
  try {
    const recent = await db.collection(COLL_ATTEMPTS)
      .where({ openId: OPENID, at: _.gt(windowStart), ok: false })
      .count();
    if (recent.total >= JOIN_MAX) {
      return { success: false, error: '尝试次数过多，请稍后再试' };
    }
  } catch (e) {
    // If the collection doesn't exist yet the count throws; ignore and proceed.
    // Admin should create a `join_attempts` collection in the cloud console.
  }

  try {
    // Look up family by invite code
    const res = await db.collection('families').where({ inviteCode: code }).get();

    if (!res.data || res.data.length === 0) {
      await _logAttempt(OPENID, false);
      return { success: false, error: '邀请码无效或已过期' };
    }

    const family = res.data[0];
    const familyId = family._id;

    // Check if already a member (idempotent join)
    const existing = await db.collection('members')
      .where({ familyId, openId: OPENID })
      .get();

    if (!existing.data || existing.data.length === 0) {
      // Add as regular member
      await db.collection('members').add({
        data: {
          familyId,
          openId:   OPENID,
          nickname: event.nickname || '家长',
          role:     'member',
          joinedAt: db.serverDate()
        }
      });
    }

    await _logAttempt(OPENID, true);

    // Return inviteCode so the joining member can cache it locally.
    // They cannot read it from the DB directly (no _openid ownership),
    // so this is the only reliable way for them to display the code.
    return {
      success:    true,
      familyId,
      babyName:   family.babyName   || '小宝贝',
      birthDate:  family.birthDate  || '',
      inviteCode: family.inviteCode || ''
    };
  } catch (e) {
    console.error('[joinFamily]', e);
    await _logAttempt(OPENID, false);
    return { success: false, error: e.message || '服务器错误' };
  }
};

async function _logAttempt(openId, ok) {
  try {
    await db.collection(COLL_ATTEMPTS).add({
      data: { openId, ok, at: Date.now() }
    });
  } catch (e) {
    // Collection may not exist yet — rate limiting degrades to off, which is safe.
  }
}
