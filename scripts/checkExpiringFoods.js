const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// Inicializa Firebase Admin com a variável de ambiente FIREBASE_SERVICE_ACCOUNT
const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Configurar email
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function checkExpiringFoods() {
  const snapshot = await db.collection("foods").get();
  const today = new Date();

  for (const doc of snapshot.docs) {
    const food = doc.data();
    const expiryDate = new Date(food.expiry);
    const diff = (expiryDate - today) / (1000 * 60 * 60 * 24);

    if (diff <= 60 && diff > 0 && !food.alertSent) {
      try {
        const userDoc = await db.collection("users").doc(food.userId).get();
        const userEmail = userDoc.exists ? userDoc.data().email : null;

        if (userEmail) {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: `Alimento perto da validade: ${food.name}`,
            text: `O alimento "${food.name}" vence em ${Math.ceil(diff)} dias.`,
          });

          await db.collection("foods").doc(doc.id).update({ alertSent: true });
          console.log(`Alerta enviado para ${userEmail} sobre ${food.name}`);
        }
      } catch (err) {
        console.error("Erro ao enviar email:", err);
      }
    }
  }
}

checkExpiringFoods().then(() => console.log("Check finalizado."));
