// Cloud function: joinFamily
// Joins an existing family using a 6-character invite code.
// Idempotent: calling again if already a member just returns family info.

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const code = (event.inviteCode || '').toUpperCase().trim();

  if (!code || code.length !== 6) {
    return { success: false, error: '邀请码格式不正确' };
  }

  try {
    // Look up family by invite code
    const res = await db.collection('families').where({ inviteCode: code }).get();

    if (!res.data || res.data.length === 0) {
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
    return { success: false, error: e.message || '服务器错误' };
  }
};
