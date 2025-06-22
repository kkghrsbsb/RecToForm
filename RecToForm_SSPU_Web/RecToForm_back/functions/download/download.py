import os
import shutil
from fastapi import APIRouter, BackgroundTasks, Query
from fastapi.responses import FileResponse
from functions.shared.task_store import user_download_queues

download = APIRouter()

def delete_folder(folder_path: str):
    try:
        shutil.rmtree(folder_path)
        print(f"成功删除文件夹：{folder_path}")
    except Exception as e:
        print(f"删除文件夹失败：{str(e)}")

@download.get('/download')
async def download_file(background_tasks: BackgroundTasks, user_id: str = Query(...)):
    if user_id not in user_download_queues or user_download_queues[user_id].empty():
        return {"error": "无可下载任务"}

    folder_name = user_download_queues[user_id].get()
    folder_path = f"functions/download/downloading_files/{folder_name}"
    file_path = os.path.join(folder_path, "发票信息.xlsx")

    background_tasks.add_task(delete_folder, folder_path)
    user_download_queues[user_id].task_done()

    return FileResponse(
        path=file_path,
        media_type="application/octet-stream",
        filename="发票信息.xlsx"
    )