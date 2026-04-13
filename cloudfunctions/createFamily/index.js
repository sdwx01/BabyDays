// Cloud function: createFamily
// Creates a new family document and adds the calling user as admin.
// Called from onboarding page when a user sets up a new baby profile.

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  try {
    const inviteCode = _generateCode();

    // Create family document
    const familyRes = await db.collection('families').add({
      data: {
        babyName:  event.babyName  || '小宝贝',
        birthDate: event.birthDate || '',
        inviteCode,
        createdBy: OPENID,
        createdAt: db.serverDate()
      }
    });

    const familyId = familyRes._id;

    // Add creator as admin member
    await db.collection('members').add({
      data: {
        familyId,
        openId:   OPENID,
        nickname: event.nickname || '家长',
        role:     'admin',
        joinedAt: db.serverDate()
      }
    });

    return { success: true, familyId, inviteCode };
  } catch (e) {
    console.error('[createFamily]', e);
    return { success: false, error: e.message || '服务器错误' };
  }
};

function _generateCode() {
  // Unambiguous alphanumeric characters (no 0/O, 1/I/L)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
