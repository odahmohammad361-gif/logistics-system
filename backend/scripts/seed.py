"""
Seed script — creates default branches and the first super_admin user.
Run from backend/ directory:
    python scripts/seed.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal
from app.models.branch import Branch
from app.models.user import User, UserRole
from app.core.security import hash_password

DEFAULT_BRANCHES = [
    {"name": "Jordan", "name_ar": "الأردن",  "code": "JO", "country": "Jordan", "city": "Amman"},
    {"name": "China",  "name_ar": "الصين",   "code": "CN", "country": "China", "city": "Guangzhou"},
    {"name": "Iraq",   "name_ar": "العراق",  "code": "IQ", "country": "Iraq", "city": "Baghdad"},
]

ADMIN_EMAIL    = "admin@logistics.jo"
ADMIN_PASSWORD = "Admin@1234"


def seed():
    db = SessionLocal()
    try:
        # Branches
        for b in DEFAULT_BRANCHES:
            exists = db.query(Branch).filter(Branch.code == b["code"]).first()
            if not exists:
                db.add(Branch(**b))
                print(f"  + Branch: {b['name']}")
            else:
                print(f"  = Branch already exists: {b['name']}")
        db.commit()

        # Super admin
        jo_branch = db.query(Branch).filter(Branch.code == "JO").first()
        admin = db.query(User).filter(User.email == ADMIN_EMAIL).first()
        if not admin:
            db.add(User(
                full_name="System Admin",
                full_name_ar="مدير النظام",
                email=ADMIN_EMAIL,
                hashed_password=hash_password(ADMIN_PASSWORD),
                role=UserRole.SUPER_ADMIN,
                branch_id=jo_branch.id if jo_branch else None,
                is_active=True,
            ))
            db.commit()
            print(f"\n  + Super admin created:")
            print(f"    Email   : {ADMIN_EMAIL}")
            print(f"    Password: {ADMIN_PASSWORD}")
            print(f"    *** Change this password immediately after first login! ***")
        else:
            print(f"  = Admin already exists: {ADMIN_EMAIL}")

    finally:
        db.close()


if __name__ == "__main__":
    print("\nSeeding database...")
    seed()
    print("Done.\n")
