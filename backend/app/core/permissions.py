from app.models.user import UserRole

# Role hierarchy — higher index = more permissions
ROLE_HIERARCHY = [
    UserRole.VIEWER,
    UserRole.STAFF,
    UserRole.BRANCH_MANAGER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
]


def role_level(role: UserRole) -> int:
    try:
        return ROLE_HIERARCHY.index(role)
    except ValueError:
        return -1


def has_permission(user_role: UserRole, required_role: UserRole) -> bool:
    """Return True if user_role meets or exceeds required_role."""
    return role_level(user_role) >= role_level(required_role)
