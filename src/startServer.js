async function startServer({ prisma, app, port }) {
  await prisma.$connect();
  return app.listen(port);
}
module.exports = { startServer };
