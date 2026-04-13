// Cloud function: generateInviteCode
// Regenerates the invite code for a family. Only the admin can do this.
// Invalidates the old code immediately.

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const familyId = event.familyId;

  if (!familyId) {
    return { success: false, error: '缺少familyId' };
  }

  try {
    // Verify caller is an admin of this family
    const memberRes = await db.collection('members')
      .where({ familyId, openId: OPENID, role: 'admin' })
      .get();

    if (!memberRes.data || memberRes.data.length === 0) {
      return { success: false, error: '只有管理员可以刷新邀请码' };
    }

    const newCode = _generateCode();

    await db.collection('families').doc(familyId).update({
      data: { inviteCode: newCode }
    });

    return { success: true, inviteCode: newCode };
  } catch (e) {
    console.error('[generateInviteCode]', e);
    return { success: false, error: e.message || '服务器错误' };
  }
};

function _generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
