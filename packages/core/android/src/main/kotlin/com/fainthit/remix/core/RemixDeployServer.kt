package com.fainthit.remix.core

import android.content.Context
import android.net.LocalServerSocket
import android.net.LocalSocket
import android.os.Process
import android.util.Log
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.io.IOException
import java.security.MessageDigest

internal class RemixDeployServer(
    context: Context,
    private val install: (String) -> Unit,
    private val onInstalled: () -> Unit,
) : AutoCloseable {
    private val cacheDirectory = File(context.cacheDir, "remix-manager")

    @Volatile
    private var closed = false

    @Volatile
    private var serverSocket: LocalServerSocket? = null

    fun start() {
        Thread(::serve, "remix-deploy-server").apply {
            isDaemon = true
            start()
        }
    }

    override fun close() {
        closed = true
        try {
            serverSocket?.close()
        } catch (_: IOException) {
            // Already closed.
        }
        serverSocket = null
    }

    private fun serve() {
        try {
            val server = LocalServerSocket(SOCKET_NAME)
            serverSocket = server
            if (closed) {
                server.close()
                return
            }

            while (!closed) {
                val installed = try {
                    server.accept().use(::handleClient)
                } catch (error: IOException) {
                    if (!closed) Log.e(TAG, "Deploy connection failed", error)
                    false
                }
                if (installed) onInstalled()
            }
        } catch (error: IOException) {
            if (!closed) Log.e(TAG, "Failed to start deploy server", error)
        } finally {
            close()
        }
    }

    private fun handleClient(socket: LocalSocket): Boolean {
        socket.soTimeout = SOCKET_TIMEOUT_MS

        return try {
            val uid = socket.peerCredentials.uid
            require(uid == Process.SHELL_UID || uid == Process.ROOT_UID) {
                "Deploy connection is not from ADB"
            }

            val input = DataInputStream(BufferedInputStream(socket.inputStream))
            val output = DataOutputStream(BufferedOutputStream(socket.outputStream))
            require(input.readInt() == PROTOCOL_MAGIC) { "Unsupported deploy protocol" }
            val size = input.readLong()
            val expectedSha256 = ByteArray(SHA256_BYTES)
            input.readFully(expectedSha256)
            require(size in 0..MAX_PACKAGE_BYTES) { "Invalid project package size: $size" }

            if (size == 0L) {
                writeResponse(output, JSONObject().put("ok", true))
                return false
            }

            require(cacheDirectory.mkdirs() || cacheDirectory.isDirectory) {
                "Failed to create deploy cache directory"
            }
            val packageFile = File.createTempFile("deploy-", ".remixprj", cacheDirectory)
            try {
                val digest = MessageDigest.getInstance("SHA-256")
                packageFile.outputStream().buffered().use { file ->
                    val buffer = ByteArray(BUFFER_SIZE)
                    var remaining = size
                    while (remaining > 0) {
                        val count = input.read(
                            buffer,
                            0,
                            minOf(buffer.size.toLong(), remaining).toInt(),
                        )
                        require(count >= 0) { "Project package stream ended early" }
                        file.write(buffer, 0, count)
                        digest.update(buffer, 0, count)
                        remaining -= count
                    }
                }

                val actualSha256 = digest.digest()
                require(MessageDigest.isEqual(expectedSha256, actualSha256)) {
                    "Project package SHA-256 verification failed"
                }
                val sha256 = actualSha256.joinToString("") {
                    "%02x".format(it.toInt() and 0xff)
                }
                install(packageFile.absolutePath)
                writeResponse(
                    output,
                    JSONObject()
                        .put("ok", true)
                        .put("sha256", sha256),
                )
                true
            } finally {
                packageFile.delete()
            }
        } catch (error: Exception) {
            Log.e(TAG, "Project deploy failed", error)
            try {
                writeResponse(
                    DataOutputStream(BufferedOutputStream(socket.outputStream)),
                    JSONObject()
                        .put("ok", false)
                        .put("error", error.message ?: error.javaClass.simpleName),
                )
            } catch (responseError: Exception) {
                Log.e(TAG, "Failed to send deploy error", responseError)
            }
            false
        }
    }

    private fun writeResponse(output: DataOutputStream, response: JSONObject) {
        val body = response.toString().toByteArray(Charsets.UTF_8)
        output.writeInt(body.size)
        output.write(body)
        output.flush()
    }

    private companion object {
        const val TAG = "RemixDeployServer"
        const val SOCKET_NAME = "remixapp-manager-v1"
        const val PROTOCOL_MAGIC = 0x524d5831
        const val SOCKET_TIMEOUT_MS = 60_000
        // ponytail: Bounds cache/disk use; raise with the manager limit if real packages exceed it.
        const val MAX_PACKAGE_BYTES = 512L * 1024 * 1024
        const val BUFFER_SIZE = 64 * 1024
        const val SHA256_BYTES = 32
    }
}
