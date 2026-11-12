import os

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, jsonify
from flask_cors import CORS

from routes.whoop import whoop_bp

app = Flask(__name__)
CORS(app, origins=[os.environ.get("FRONTEND_URL", "http://localhost:5173")], supports_credentials=True)


@app.errorhandler(Exception)
def handle_exception(e):
    print(f"Unhandled error: {e}")
    return jsonify({"error": "Internal server error"}), 500

app.register_blueprint(whoop_bp)


@app.route("/api/health")
def health_check():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3001))
    app.run(host="0.0.0.0", port=port, debug=True)
