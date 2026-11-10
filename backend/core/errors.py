class AppError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def unauthorized(detail="Войди в аккаунт или обнови сессию."):
    return AppError(401, detail)
