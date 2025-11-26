// scripts/checkExpiringFoods.js
const functions = require("firebase-functions"); // opcional, só se precisar localmente
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// Inicializa Firebase Admin com a conta de serviço
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Configura email com Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,  // email remetente
    pass: process.env.EMAIL_PASS,  // senha de app
  },
});

async function main() {
  console.log("========== Iniciando checkExpiringFoods.js ==========");
  
  try {
    const snapshot = await db.collection("foods").get();

    if (snapshot.empty) {
      console.log("Nenhum alimento encontrado no Firestore.");
      return;
    }

    for (const doc of snapshot.docs) {
      const food = doc.data();
      const today = new Date();
      const expiryDate = new Date(food.expiry);
      const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

      console.log("\nProcessando alimento:", food.name);
      console.log("Data de validade:", food.expiry);
      console.log("Dias restantes:", diffDays);
      console.log("Alert sent:", food.alertSent);
      console.log("Email do usuário:", food.userEmail);

      // Condição para envio do alerta
      if (diffDays <= 60 && diffDays > 0 && !food.alertSent && food.userEmail) {
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: food.userEmail,
            subject: "Alimento perto da validade",
            text: `O alimento "${food.name}" vence em ${diffDays} dias.`,
          });
          console.log("✅ Email enviado para:", food.userEmail);

          // Atualiza no Firestore que o alerta foi enviado
          await db.collection("foods").doc(doc.id).update({ alertSent: true });
        } catch (err) {
          console.error("❌ Erro ao enviar email para", food.userEmail, ":", err);
        }
      } else {
        console.log("⏩ Alerta não enviado (não atende critérios).");
      }
    }

    console.log("========== checkExpiringFoods.js finalizado ==========");
  } catch (error) {
    console.error("Erro ao acessar Firestore:", error);
  }
}

// Executa a função
main();

