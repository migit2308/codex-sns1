from alembic import context

from sns.database import database_path, writable_engine
from sns.models import PostRecord

target_metadata = PostRecord.metadata
path = database_path()
if context.is_offline_mode():
    raise RuntimeError("このプロジェクトの移行はオンラインモードで実行してください。")

path.parent.mkdir(parents=True, exist_ok=True)
engine = writable_engine(path)
try:
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
finally:
    engine.dispose()
