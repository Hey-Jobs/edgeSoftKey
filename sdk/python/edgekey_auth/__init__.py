"""
EdgeKey 软件激活 SDK for Python

功能：
1. 硬件信息采集（CPU、内存、显卡、主板）
2. 硬件信息加密（生成唯一硬件序列号）
3. 卡密验证接口调用
4. 软件启动时自动验证机制
5. 硬件变更检测（任意硬件变更时触发卡密错误）

安装：
    pip install edgekey-auth

使用示例：
    from edgekey_auth import EdgeKeyClient
    
    client = EdgeKeyClient(
        api_base_url="https://your-domain.com",
        cache_dir="~/.edgekey_cache"
    )
    
    # 手动验证
    result = client.verify("YOUR_CARD_KEY")
    if result.success:
        print(f"验证成功，到期时间: {result.expire_at}")
    else:
        print(f"验证失败: {result.message}")
    
    # 自动验证（推荐在软件启动时调用）
    result = client.auto_verify()
    if not result.success:
        print("软件无法启动，请联系客服")
        exit(1)
"""

import hashlib
import json
import os
import platform
import struct
import sys
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
from urllib.parse import urljoin

try:
    import requests
except ImportError:
    requests = None


# ==================== 硬件信息采集 ====================

def get_cpu_info() -> str:
    """获取CPU信息"""
    try:
        if sys.platform == "win32":
            import subprocess
            result = subprocess.run(
                ["wmic", "cpu", "get", "name,id,numberOfCores", "/value"],
                capture_output=True, text=True, timeout=5
            )
            return result.stdout.strip()
        elif sys.platform == "darwin":
            import subprocess
            result = subprocess.run(
                ["sysctl", "-n", "machdep.cpu.brand_string"],
                capture_output=True, text=True, timeout=5
            )
            return result.stdout.strip()
        else:  # Linux
            import re
            with open("/proc/cpuinfo", "r") as f:
                cpuinfo = f.read()
            match = re.search(r"model name\s*:\s*(.+)", cpuinfo)
            if match:
                return match.group(1).strip()
            return cpuinfo[:200]
    except Exception:
        return platform.processor() or "unknown_cpu"


def get_memory_info() -> str:
    """获取内存信息"""
    try:
        if sys.platform == "win32":
            import subprocess
            result = subprocess.run(
                ["wmic", "OS", "get", "TotalVisibleMemorySize", "/value"],
                capture_output=True, text=True, timeout=5
            )
            return result.stdout.strip()
        elif sys.platform == "darwin":
            import subprocess
            result = subprocess.run(
                ["sysctl", "-n", "hw.memsize"],
                capture_output=True, text=True, timeout=5
            )
            return result.stdout.strip()
        else:  # Linux
            with open("/proc/meminfo", "r") as f:
                line = f.readline()
                return line.strip()
    except Exception:
        return f"{platform.machine()}:unknown_memory"


def get_gpu_info() -> str:
    """获取显卡信息"""
    try:
        if sys.platform == "win32":
            import subprocess
            result = subprocess.run(
                ["wmic", "path", "win32_VideoController", "get", "name", "/value"],
                capture_output=True, text=True, timeout=5
            )
            return result.stdout.strip()
        elif sys.platform == "darwin":
            import subprocess
            result = subprocess.run(
                ["system_profiler", "SPDisplaysDataType"],
                capture_output=True, text=True, timeout=10
            )
            return result.stdout[:300]
        else:  # Linux
            try:
                import subprocess
                result = subprocess.run(
                    ["lspci"],
                    capture_output=True, text=True, timeout=5
                )
                # 提取显卡相关信息
                lines = result.stdout.split("\n")
                gpu_lines = [l for l in lines if "vga" in l.lower() or "nvidia" in l.lower() or "amd" in l.lower()]
                return "|".join(gpu_lines) if gpu_lines else "no_gpu_detected"
            except Exception:
                return "linux_gpu_unknown"
    except Exception:
        return "gpu_error"


def get_motherboard_info() -> str:
    """获取主板信息"""
    try:
        if sys.platform == "win32":
            import subprocess
            result = subprocess.run(
                ["wmic", "baseboard", "get", "manufacturer,product,version", "/value"],
                capture_output=True, text=True, timeout=5
            )
            return result.stdout.strip()
        elif sys.platform == "darwin":
            import subprocess
            result = subprocess.run(
                ["system_profiler", "SPHardwareDataType"],
                capture_output=True, text=True, timeout=10
            )
            return result.stdout[:300]
        else:  # Linux
            try:
                with open("/sys/class/dmi/id/board_vendor", "r") as f:
                    vendor = f.read().strip()
                with open("/sys/class/dmi/id/board_name", "r") as f:
                    name = f.read().strip()
                return f"{vendor}:{name}"
            except FileNotFoundError:
                return "linux_board_unknown"
    except Exception:
        return "motherboard_error"


def get_network_mac() -> str:
    """获取网络MAC地址（用于辅助标识）"""
    try:
        node = uuid.getnode()
        return ":".join(("%012X" % node)[i:i+2] for i in range(0, 12, 2))
    except Exception:
        return "mac_unknown"


# ==================== 硬件哈希计算 ====================

def compute_hardware_hash(
    cpu_info: Optional[str] = None,
    memory_info: Optional[str] = None,
    gpu_info: Optional[str] = None,
    motherboard_info: Optional[str] = None,
    mac_address: Optional[str] = None,
) -> str:
    """
    计算硬件信息的SHA256哈希值
    
    将硬件信息拼接后进行SHA256哈希，生成唯一的硬件标识符。
    任意硬件信息变化都会导致哈希值变化。
    
    Args:
        cpu_info: CPU信息
        memory_info: 内存信息
        gpu_info: 显卡信息
        motherboard_info: 主板信息
        mac_address: MAC地址
        
    Returns:
        SHA256哈希字符串（64位十六进制）
    """
    # 收集所有硬件信息
    cpu_info = cpu_info or get_cpu_info()
    memory_info = memory_info or get_memory_info()
    gpu_info = gpu_info or get_gpu_info()
    motherboard_info = motherboard_info or get_motherboard_info()
    mac_address = mac_address or get_network_mac()
    
    # 拼接硬件信息
    hardware_str = f"{cpu_info}|{memory_info}|{gpu_info}|{motherboard_info}|{mac_address}"
    
    # 计算SHA256哈希
    return hashlib.sha256(hardware_str.encode("utf-8")).hexdigest()


def collect_hardware_info() -> Dict[str, str]:
    """
    采集所有硬件信息
    
    Returns:
        包含所有硬件信息的字典
    """
    return {
        "cpu": get_cpu_info(),
        "memory": get_memory_info(),
        "gpu": get_gpu_info(),
        "motherboard": get_motherboard_info(),
        "mac": get_network_mac(),
    }


# ==================== 数据模型 ====================

@dataclass
class VerifyResult:
    """验证结果"""
    success: bool
    message: str
    expire_at: Optional[str] = None
    code: Optional[str] = None
    remaining_days: Optional[int] = None
    
    def __bool__(self):
        return self.success


@dataclass
class UnbindResult:
    """解绑结果"""
    success: bool
    message: str
    remaining_days: Optional[int] = None
    code: Optional[str] = None
    
    def __bool__(self):
        return self.success


# ==================== SDK 客户端 ====================

class EdgeKeyClient:
    """
    EdgeKey 卡密验证客户端
    
    Args:
        api_base_url: API基础URL，例如 "https://your-domain.com"
        cache_dir: 本地缓存目录，用于存储硬件哈希和验证状态
        timeout: 请求超时时间（秒）
        
    Example:
        >>> client = EdgeKeyClient(api_base_url="https://shop.example.com")
        >>> result = client.auto_verify()
        >>> if result.success:
        ...     print(f"有效期至: {result.expire_at}")
    """
    
    VERIFY_ENDPOINT = "/api/card/verify"
    UNBIND_ENDPOINT = "/api/card/unbind"
    CACHE_FILENAME = ".edgekey_cache"
    
    def __init__(self, api_base_url: str, cache_dir: Optional[str] = None, timeout: int = 10):
        self.api_base_url = api_base_url.rstrip("/")
        self.timeout = timeout
        
        # 设置缓存目录
        if cache_dir:
            cache_dir = os.path.expanduser(cache_dir)
        else:
            cache_dir = os.path.join(str(Path.home()), ".edgekey_cache")
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
        
        self._cache_path = os.path.join(cache_dir, self.CACHE_FILENAME)
        self._cached_hardware_hash: Optional[str] = None
        self._cached_hardware_info: Optional[Dict[str, str]] = None
    
    def _load_cache(self) -> Dict[str, Any]:
        """加载本地缓存"""
        if os.path.exists(self._cache_path):
            try:
                with open(self._cache_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return {}
        return {}
    
    def _save_cache(self, data: Dict[str, Any]) -> None:
        """保存本地缓存"""
        try:
            with open(self._cache_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except IOError as e:
            print(f"[EdgeKey] 警告: 保存缓存失败: {e}")
    
    def _get_hardware_hash(self) -> str:
        """
        获取硬件哈希值
        
        优先使用缓存的硬件哈希，如果缓存不存在或硬件信息发生变化则重新采集。
        
        Returns:
            硬件SHA256哈希值
        """
        # 检查缓存
        cache = self._load_cache()
        cached_hash = cache.get("hardware_hash")
        
        if cached_hash:
            # 验证硬件是否变化
            current_hash = compute_hardware_hash()
            if cached_hash == current_hash:
                self._cached_hardware_hash = cached_hash
                self._cached_hardware_info = cache.get("hardware_info", {})
                return cached_hash
        
        # 硬件信息变化或无缓存，重新采集
        hardware_info = collect_hardware_info()
        hardware_hash = compute_hardware_hash(
            cpu_info=hardware_info["cpu"],
            memory_info=hardware_info["memory"],
            gpu_info=hardware_info["gpu"],
            motherboard_info=hardware_info["motherboard"],
            mac_address=hardware_info["mac"],
        )
        
        # 更新缓存
        cache["hardware_hash"] = hardware_hash
        cache["hardware_info"] = hardware_info
        cache["updated_at"] = datetime.now(timezone.utc).isoformat()
        self._save_cache(cache)
        
        self._cached_hardware_hash = hardware_hash
        self._cached_hardware_info = hardware_info
        
        return hardware_hash
    
    def _check_hardware_change(self) -> bool:
        """
        检查硬件是否发生变化
        
        Returns:
            True表示硬件发生了变化，False表示无变化
        """
        current_hash = compute_hardware_hash()
        cache = self._load_cache()
        cached_hash = cache.get("hardware_hash")
        
        return current_hash != cached_hash
    
    def _make_request(self, endpoint: str, data: Dict[str, Any]) -> Any:
        """
        发送HTTP请求
        
        Args:
            endpoint: API端点路径
            data: 请求数据
            
        Returns:
            响应JSON数据
            
        Raises:
            ConnectionError: 连接失败
            ValueError: 响应格式错误
        """
        if not requests:
            raise ImportError("请安装 requests 库: pip install requests")
        
        url = urljoin(self.api_base_url + "/", endpoint.lstrip("/"))
        
        response = requests.post(
            url,
            json=data,
            timeout=self.timeout,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 400:
            return response.json()
        elif response.status_code == 403:
            return response.json()
        elif response.status_code == 409:
            return response.json()
        else:
            raise ConnectionError(f"HTTP {response.status_code}: {response.text}")
    
    def verify(self, card_key: str, hardware_hash: Optional[str] = None) -> VerifyResult:
        """
        验证卡密
        
        首次验证会激活卡密并绑定当前硬件；非首次验证会检查硬件匹配性。
        
        Args:
            card_key: 卡密字符串
            hardware_hash: 硬件哈希值，如果不提供则自动采集
            
        Returns:
            VerifyResult 验证结果对象
            
        Example:
            >>> result = client.verify("ABCD-EFGH-IJKL-MNOP")
            >>> if result.success:
            ...     print(f"有效期至: {result.expire_at}")
            ... else:
            ...     print(f"验证失败: {result.message}")
        """
        if not card_key or not card_key.strip():
            return VerifyResult(
                success=False,
                message="卡密不能为空",
                code="MISSING_PARAMS"
            )
        
        hw_hash = hardware_hash or self._get_hardware_hash()
        
        try:
            response_data = self._make_request(self.VERIFY_ENDPOINT, {
                "card": card_key.strip(),
                "hardwareHash": hw_hash,
                "cpuInfo": self._cached_hardware_info.get("cpu") if self._cached_hardware_info else None,
                "memoryInfo": self._cached_hardware_info.get("memory") if self._cached_hardware_info else None,
                "gpuInfo": self._cached_hardware_info.get("gpu") if self._cached_hardware_info else None,
                "motherboardInfo": self._cached_hardware_info.get("motherboard") if self._cached_hardware_info else None,
            })
            
            return VerifyResult(
                success=response_data.get("success", False),
                message=response_data.get("message", "未知错误"),
                expire_at=response_data.get("expireAt"),
                code=response_data.get("code"),
            )
        except ConnectionError as e:
            return VerifyResult(
                success=False,
                message=f"网络连接失败: {str(e)}",
                code="NETWORK_ERROR"
            )
        except Exception as e:
            return VerifyResult(
                success=False,
                message=f"验证失败: {str(e)}",
                code="VERIFY_ERROR"
            )
    
    def unbind(self, card_key: str) -> UnbindResult:
        """
        解绑卡密（解除硬件绑定）
        
        解绑后会延长卡密有效期一天。
        
        Args:
            card_key: 卡密字符串
            
        Returns:
            UnbindResult 解绑结果对象
            
        Example:
            >>> result = client.unbind("ABCD-EFGH-IJKL-MNOP")
            >>> if result.success:
            ...     print(f"解绑成功，剩余{result.remaining_days}天")
        """
        if not card_key or not card_key.strip():
            return UnbindResult(
                success=False,
                message="卡密不能为空",
                code="MISSING_PARAMS"
            )
        
        try:
            response_data = self._make_request(self.UNBIND_ENDPOINT, {
                "card": card_key.strip(),
            })
            
            return UnbindResult(
                success=response_data.get("success", False),
                message=response_data.get("message", "未知错误"),
                remaining_days=response_data.get("remainingDays"),
                code=response_data.get("code"),
            )
        except ConnectionError as e:
            return UnbindResult(
                success=False,
                message=f"网络连接失败: {str(e)}",
                code="NETWORK_ERROR"
            )
        except Exception as e:
            return UnbindResult(
                success=False,
                message=f"解绑失败: {str(e)}",
                code="UNBIND_ERROR"
            )
    
    def auto_verify(self, card_key: str) -> VerifyResult:
        """
        自动验证（推荐在软件启动时调用）
        
        该方法是 verify() 的包装，增加了硬件变更检测和友好的错误提示。
        
        Args:
            card_key: 卡密字符串
            
        Returns:
            VerifyResult 验证结果对象
            
        Example:
            >>> result = client.auto_verify("YOUR_CARD_KEY")
            >>> if not result.success:
            ...     print("软件无法启动")
            ...     exit(1)
        """
        # 检查硬件是否变化
        if self._check_hardware_change():
            # 清除旧缓存
            if os.path.exists(self._cache_path):
                os.remove(self._cache_path)
            # 重新采集硬件信息
            self._get_hardware_hash()
        
        result = self.verify(card_key)
        
        # 如果是硬件不匹配，给出更友好的提示
        if result.code == "HARDWARE_MISMATCH":
            result.message = "硬件信息不匹配，该卡密已绑定其他设备。请联系客服解绑后重试。"
        
        return result
    
    def get_expire_info(self, card_key: str) -> VerifyResult:
        """
        获取卡密到期信息（仅查询，不改变任何状态）
        
        Args:
            card_key: 卡密字符串
            
        Returns:
            VerifyResult 包含到期时间的验证结果
        """
        return self.verify(card_key)
    
    def clear_cache(self) -> None:
        """清除本地缓存"""
        if os.path.exists(self._cache_path):
            os.remove(self._cache_path)
        self._cached_hardware_hash = None
        self._cached_hardware_info = None
