export default defineEventHandler(async (event) => {
  const familyGroupId = getRouterParam(event, 'family_group_id');
  const body = await readBody(event);
  return { message: `Hello Family Group ${familyGroupId}` };
});
